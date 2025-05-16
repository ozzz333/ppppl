  // Try to create and send a Solana transaction using direct RPC calls
  const sendDirectTransaction = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      setError("Phantom wallet not connected");
      return false;
    }

    if (legs.length === 0) {
      setError("No legs added to the parlay");
      return false;
    }

    if (betAmount <= 0) {
      setError("Bet amount must be greater than 0");
      return false;
    }

    try {
      setIsTransacting(true);
      setTransactionStatus("Preparing transaction...");
      setError(""); // Clear any previous errors

      // Get user public key from Phantom
      console.log("Getting public key from phantom...");
      const fromPubkey = window.solana.publicKey;
      console.log("Got public key:", fromPubkey.toString());
      
      // Get the treasury wallet
      console.log("Using treasury wallet:", TREASURY_WALLET);
      
      if (TREASURY_WALLET === "DQeRRYooThKaTY4XZyeiFFpPnrqLSrdmEGhJzXpXYswg") {
        throw new Error("Please set a valid treasury wallet address before placing bets");
      }
      
      const toPubkey = new web3.PublicKey(TREASURY_WALLET);
      
      // Create a transaction
      console.log("Creating transaction with amount:", betAmount);
      const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(betAmount * 1e9), // Convert SOL to lamports
        })
      );

      // Create memo data
      const betData = {
        legs: legs.map(leg => ({
          asset: leg.asset,
          timeframe: leg.timeframe,
          lowerBound: leg.lowerBound,
          upperBound: leg.upperBound,
          priceAtAdd: leg.priceAtAdd
        })),
        odds: parlayOdds,
        timestamp: Date.now()
      };

      // Get recent blockhash using direct RPC call
      setTransactionStatus("Getting recent blockhash...");
      try {
        const { blockhash } = await directRpcCall('getRecentBlockhash');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        
        // Sign transaction with Phantom
        setTransactionStatus("Awaiting wallet approval...");
        const signed = await window.solana.signTransaction(transaction);
        
        // Send transaction using direct RPC
        setTransactionStatus("Sending transaction to Solana...");
        const serializedTx = signed.serialize();
        const encodedTx = Buffer.from(serializedTx).toString('base64');
        
        const signature = await directRpcCall('sendTransaction', [
          encodedTx,
          { encoding: 'base64' }
        ]);
        
        console.log("Transaction sent via direct RPC! Signature:", signature);
        
        // Confirm transaction
        setTransactionStatus("Confirming transaction...");
        let confirmed = false;
        let attempts = 0;
        
        while (!confirmed && attempts < 30) {
          attempts++;
          try {
            const status = await directRpcCall('getSignatureStatuses', [[signature]]);
            if (status && status[0]) {
              if (status[0].confirmationStatus === 'confirmed' || status[0].confirmationStatus === 'finalized') {
                confirmed = true;
                break;
              }
            }
          } catch (e) {
            console.error("Error checking confirmation:", e);
          }
          
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          setTransactionStatus(`Confirming transaction... (attempt ${attempts}/30)`);
        }
        
        if (confirmed) {
          setTransactionStatus("Transaction confirmed! Signature: " + signature);
          
          // Add bet to history
          const ticket = {
            legs,
            betAmount,
            timestamp: new Date().toISOString(),
            signature,
            status: 'confirmed',
            explorerUrl: `https://explorer.solana.com/tx/${signature}`
          };
          
          setHistory([ticket, ...history]);
          setLegs([]);
          setIsTransacting(false);
          
          // Try to get updated balance
          try {
            const balanceResponse = await directRpcCall('getBalance', [fromPubkey.toString()]);
            setWalletBalance((balanceResponse / 1e9).toFixed(2));
          } catch (e) {
            console.error("Failed to get updated balance:", e);
          }
          
          return true;
        } else {
          throw new Error("Transaction could not be confirmed after 30 attempts");
        }
      } catch (err) {
        console.error("Direct transaction failed:", err);
        throw err;
      }
    } catch (err) {
      console.error("Transaction failed", err);
      setError("Transaction failed: " + err.message);
      setTransactionStatus("Transaction failed");
      setIsTransacting(false);
      
      // Fall back to regular sendBetTransaction if direct method fails
      setTransactionStatus("Trying alternative transaction method...");
      return sendBetTransaction();
    }
  };  // Direct RPC fetch method (uses your Helius endpoint)
  const directRpcCall = async (method, params = []) => {
    try {
      const response = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (ParlayApp)',
          'Origin': window.location.origin
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'prly-' + Date.now(),
          method,
          params
        })
      });
      
      const data = await response.json();
      console.log(`Direct RPC call to ${method}:`, data);
      
      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      return data.result;
    } catch (err) {
      console.error(`Direct RPC call to ${method} failed:`, err);
      throw err;
    }
  };  // Place bet with multiple fallback methods
  const placeBet = async () => {
    // If in offline mode, simulate a successful bet
    if (diagnosticInfo.offlineMode) {
      setIsTransacting(true);
      setTransactionStatus("Simulating transaction in offline mode...");
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a fake signature
      const fakeSignature = 'SIMULATED_' + Math.random().toString(36).substring(2, 15);
      
      // Add to history
      const ticket = {
        legs,
        betAmount,
        timestamp: new Date().toISOString(),
        signature: fakeSignature,
        status: 'simulated',
        offline: true
      };
      
      setHistory([ticket, ...history]);
      setLegs([]);
      setIsTransacting(false);
      setTransactionStatus("Bet simulated in offline mode. No actual transaction was sent.");
      
      return true;
    }
    
    // First try direct RPC approach (most reliable)
    try {
      return await sendDirectTransaction();
    } catch (err) {
      console.error("Direct transaction method failed:", err);
      setTransactionStatus("Direct transaction failed. Trying standard Web3.js method...");
      
      // Fall back to standard Web3.js approach
      return sendBetTransaction();
    }
  };  // Initial connection test when component mounts
  useEffect(() => {
    // Wait a moment before testing connection
    const timer = setTimeout(() => {
      testRpcConnection();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);  const [retryCount, setRetryCount] = useState(0);
  const [diagnosticInfo, setDiagnosticInfo] = useState({});  // Testing the RPC connection (simplified for single endpoint)
  const testRpcConnection = async () => {
    setTransactionStatus("Testing Helius RPC connection...");
    try {
      // Try direct RPC call
      const slot = await directRpcCall('getSlot');
      console.log("Helius RPC connection test successful:", slot);
      setTransactionStatus(`Helius RPC connected successfully (slot: ${slot})`);
      setDiagnosticInfo(prev => ({
        ...prev,
        connectionStatus: 'connected',
        lastTestTime: Date.now(),
        directCallSuccess: true
      }));
      return true;
    } catch (error) {
      console.error("Helius RPC test failed:", error);
      setTransactionStatus(`Helius RPC connection failed: ${error.message}`);
      setDiagnosticInfo(prev => ({
        ...prev,
        lastError: error.message,
        connectionStatus: 'failed'
      }));
      return false;
    }
  };

  // Effect to test connection when RPC endpoint changes
  useEffect(() => {
    if (connection) {
      testRpcConnection();
    }
  }, [connection]);import React, { useState, useMemo, useEffect } from 'react';
import * as web3 from '@solana/web3.js';

const Card = ({ children }) => <div className="border rounded-xl p-4 shadow bg-white">{children}</div>;
const CardContent = ({ children, className }) => <div className={className}>{children}</div>;
const Button = ({ children, className = '', ...props }) => (
  <button
    className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default function ParlayBuilder() {
  const [legs, setLegs] = useState([]);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [timeframe, setTimeframe] = useState("24-hour");
  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(0);
  const [betAmount, setBetAmount] = useState(100);
  const [error, setError] = useState("");
  const [livePrice, setLivePrice] = useState(0);
  const [liveVolatility, setLiveVolatility] = useState(null);
  const [isTransacting, setIsTransacting] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [currentRpcIndex, setCurrentRpcIndex] = useState(0);

  // Treasury wallet address where bets will be sent
  const TREASURY_WALLET = "YOUR_TREASURY_WALLET_ADDRESS"; // Replace with your actual treasury wallet address

  // RPC Endpoints - prioritizing the one that works
  const RPC_ENDPOINTS = [
    "https://solana.public-rpc.com", // Mercury - Triton (endpoint #2 that seems to work)
    "https://mainnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff", // Helius with a different API key
    "https://api.mainnet-beta.solana.com", // Official Solana endpoint
    "https://api.metaplex.solana.com/" // Metaplex RPC
  ];

  // Select an RPC endpoint - we'll use the current index from our list
  const rpcEndpoint = useMemo(() => {
    return RPC_ENDPOINTS[currentRpcIndex];
  }, [currentRpcIndex]);

  // Create a Solana connection with the Helius RPC
  const connection = useMemo(() => {
    console.log("Creating connection to Helius RPC");
    try {
      return new web3.Connection(HELIUS_RPC, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 30000,
        fetch: customFetch
      });
    } catch (err) {
      console.error("Failed to create Solana connection:", err);
      return null;
    }
  }, []);
  
  // Custom fetch function optimized for Helius
  function customFetch(url, options) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (ParlayApp)',
      'Origin': window.location.origin
    };
    
    const fetchOptions = {
      ...options,
      headers: { ...options.headers, ...headers },
      mode: 'cors',
      cache: 'no-cache'
    };
    
    return fetch(url, fetchOptions);
  }

  const RANGE_WIDTHS = {
    BTC: {
      "1-hour": { min: 0.005, max: 0.05 },
      "24-hour": { min: 0.01, max: 0.12 },
      "7-day": { min: 0.015, max: 0.18 },
      "30-day": { min: 0.025, max: 0.25 }
    },
    ETH: {
      "1-hour": { min: 0.0075, max: 0.06 },
      "24-hour": { min: 0.015, max: 0.15 },
      "7-day": { min: 0.025, max: 0.22 },
      "30-day": { min: 0.035, max: 0.30 }
    },
    SOL: {
      "1-hour": { min: 0.01, max: 0.07 },
      "24-hour": { min: 0.02, max: 0.17 },
      "7-day": { min: 0.03, max: 0.25 },
      "30-day": { min: 0.04, max: 0.35 }
    },
    LINK: {
      "1-hour": { min: 0.01, max: 0.08 },
      "24-hour": { min: 0.02, max: 0.18 },
      "7-day": { min: 0.03, max: 0.26 },
      "30-day": { min: 0.04, max: 0.36 }
    },
    DOGE: {
      "1-hour": { min: 0.015, max: 0.10 },
      "24-hour": { min: 0.025, max: 0.20 },
      "7-day": { min: 0.035, max: 0.30 },
      "30-day": { min: 0.05, max: 0.40 }
    }
  };

  const ASSETS = {
    BTC: { name: "Bitcoin", symbol: "bitcoin", volatility: 0.02, marketCapTier: "Mega" },
    ETH: { name: "Ethereum", symbol: "ethereum", volatility: 0.025, marketCapTier: "Large" },
    SOL: { name: "Solana", symbol: "solana", volatility: 0.035, marketCapTier: "Mid" },
    LINK: { name: "Chainlink", symbol: "chainlink", volatility: 0.04, marketCapTier: "Small" },
    DOGE: { name: "Dogecoin", symbol: "dogecoin", volatility: 0.06, marketCapTier: "Micro" }
  };

  const TIMEFRAMES = {
    "1-hour": 1,
    "4-hour": 4,
    "24-hour": 24,
    "48-hour": 48,
    "3-day": 72,
    "7-day": 168,
    "14-day": 336,
    "30-day": 720
  };

  // Function to handle wallet connection
  const connectWallet = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      alert("Phantom Wallet not found. Please install it.");
      return;
    }

    try {
      // Clear any previous errors
      setError("");
      
      console.log("Attempting to connect wallet...");
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      console.log("Wallet connected:", address);
      
      // Wait a moment before trying to get balance to ensure connection is established
      setTimeout(async () => {
        try {
          if (connection) {
            console.log("Getting balance for address:", address);
            const publicKey = new web3.PublicKey(address);
            const balance = await connection.getBalance(publicKey);
            console.log("Balance received:", balance);
            setWalletBalance((balance / 1e9).toFixed(2));
          } else {
            console.error("No connection available");
            setError("Failed to connect to Solana network. Please try again.");
          }
        } catch (balanceErr) {
          console.error("Failed to get balance:", balanceErr);
          // Don't set error message here to prevent continuous errors
        }
      }, 1000);
    } catch (error) {
      console.error("User denied wallet connection", error);
      setError("Wallet connection was denied.");
    }
  };

  // Try to connect to a different RPC endpoint
  const tryAlternativeRpcEndpoint = () => {
    // If we have found a working endpoint in the past, just use that one
    if (diagnosticInfo.lastSuccessfulRpc !== undefined) {
      console.log(`Switching to known working RPC #${diagnosticInfo.lastSuccessfulRpc}: ${diagnosticInfo.lastSuccessfulEndpoint}`);
      setTransactionStatus(`Switching to known working RPC endpoint...`);
      setCurrentRpcIndex(diagnosticInfo.lastSuccessfulRpc);
      return null;
    }
    
    // Otherwise try the next one
    const nextIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newEndpoint = RPC_ENDPOINTS[nextIndex];
    
    console.log(`Switching from RPC ${currentRpcIndex} to ${nextIndex}: ${newEndpoint}`);
    setTransactionStatus(`Switching to alternative RPC endpoint (${nextIndex + 1}/${RPC_ENDPOINTS.length})...`);
    
    // Update retry count
    setRetryCount(prev => prev + 1);
    
    // Update the state with the new index
    setCurrentRpcIndex(nextIndex);
    
    // If we've tried all endpoints, show diagnostic info
    if (nextIndex === 0 && retryCount >= RPC_ENDPOINTS.length) {
      console.error("All RPC endpoints failed. Network might be down or restricted.");
      setDiagnosticInfo(prev => ({ 
        ...prev, 
        allEndpointsFailed: true,
        failedEndpoints: [...RPC_ENDPOINTS]
      }));
    }
    
    return null;
  };

  // Auto-connect to wallet if already authorized
  useEffect(() => {
    if (window.solana && window.solana.isPhantom && connection) {
      console.log("Attempting auto-connect...");
      window.solana.connect({ onlyIfTrusted: true })
        .then(async (res) => {
          const address = res.publicKey.toString();
          setWalletAddress(address);
          console.log("Auto-connected to wallet:", address);
          setTimeout(async () => {
            try {
              console.log("Getting balance for auto-connected wallet");
              const publicKey = new web3.PublicKey(address);
              const balance = await connection.getBalance(publicKey);
              console.log("Balance received:", balance);
              setWalletBalance((balance / 1e9).toFixed(2));
            } catch (err) {
              console.error("Failed to get balance for auto-connected wallet:", err);
            }
          }, 1000);
        })
        .catch((err) => {
          // Silent fail if not previously trusted
          console.log("Auto-connect failed (expected if not previously authorized):", err);
        });
    } else {
      console.log("Auto-connect prerequisites not met:", {
        hasPhantom: Boolean(window.solana && window.solana.isPhantom),
        hasConnection: Boolean(connection)
      });
    }
  }, [connection]);

  // Fetch live price for selected asset
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ASSETS[selectedAsset].symbol}&vs_currencies=usd`);
        const data = await res.json();
        setLivePrice(data[ASSETS[selectedAsset].symbol].usd);
      } catch (err) {
        console.error("Error fetching live price", err);
        setLivePrice(0);
      }
    }
    fetchPrice();
  }, [selectedAsset]);

  // Fetch volatility data for selected asset
  useEffect(() => {
    async function fetchVolatility() {
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${ASSETS[selectedAsset].symbol}/market_chart?vs_currency=usd&days=90&interval=daily`);
        const data = await res.json();
        const prices = data.prices.map(p => p[1]);
        const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
        const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
        const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
        const outlierCount = prices.slice(1).reduce((count, price, i) => {
          const change = Math.abs((price - prices[i]) / prices[i]);
          return count + (change >= 0.10 ? 1 : 0);
        }, 0);
        const tailFactor = 1 + Math.min(outlierCount / 90, 0.25);
        const dailyVolatility = Math.sqrt(variance) * tailFactor;
        setLiveVolatility(dailyVolatility);
      } catch (err) {
        console.error("Error fetching volatility", err);
        setLiveVolatility(null);
      }
    }
    fetchVolatility();
  }, [selectedAsset]);

  const calculateProbability = (price, lower, upper, volatility, timeframe, marketCapTier) => {
    const MARKET_CAP_MULTIPLIERS = {
      Mega: 0.8,
      Large: 0.9,
      Mid: 1.0,
      Small: 1.1,
      Micro: 1.2
    };
    const baseMultiplier = MARKET_CAP_MULTIPLIERS[marketCapTier] || 1.0;

    const tfHours = TIMEFRAMES[timeframe];
    const tailRiskFactor = 1 + Math.pow(Math.abs(upper - lower) / price, 0.5);
    const stdDev = price * volatility * Math.sqrt(tfHours / 24) * baseMultiplier * tailRiskFactor;

    const z1 = (Math.min(lower, upper) - price) / stdDev;
    const z2 = (Math.max(lower, upper) - price) / stdDev;
    const normalCDF = z => 0.5 * (1 + Math.tanh(Math.sqrt(Math.PI / 8) * z));
    const probability = normalCDF(z2) - normalCDF(z1);

    return Math.min(probability, 0.25);
  };

  const selectedRangePercent = useMemo(() => {
    if (!lowerBound || !upperBound || upperBound <= lowerBound || livePrice === 0) return null;
    const range = (Math.abs(upperBound - lowerBound) / livePrice) * 100;
    return range.toFixed(2);
  }, [lowerBound, upperBound, livePrice]);

  const rangeDifficultyLabel = useMemo(() => {
    const width = Math.abs(upperBound - lowerBound) / livePrice;
    if (width <= 0.02) return "Hard";
    if (width <= 0.05) return "Medium";
    return "Easy";
  }, [lowerBound, upperBound, livePrice]);

  const parlayProbability = useMemo(() => {
    if (legs.length === 0 || !liveVolatility || !livePrice) return 0;
    let prob = legs.reduce((acc, leg) => {
      const asset = ASSETS[leg.asset];
      const p = calculateProbability(
        leg.priceAtAdd,
        leg.lowerBound,
        leg.upperBound,
        leg.volatilityAtAdd,
        leg.timeframe,
        asset.marketCapTier
      );
      if (isNaN(p) || p === 0) return 0;
      return acc * p;
    }, 1);
    const correlationDiscount = 0.83; // static for now
    const parlayBonus = legs.length >= 4 ? 1.05 : 1.0;
    return (prob / correlationDiscount) * parlayBonus;
  }, [legs, liveVolatility, livePrice]);

  const parlayOdds = useMemo(() => {
    if (parlayProbability === 0) return 0;
    return (1 / parlayProbability) * 0.93; // 7% house edge
  }, [parlayProbability]);

  const totalPayout = useMemo(() => {
    return betAmount * parlayOdds;
  }, [betAmount, parlayOdds]);

  // Function to create and send a Solana transaction
  const sendBetTransaction = async () => {
    console.log("Starting sendBetTransaction...");
    if (!window.solana || !window.solana.isPhantom) {
      setError("Phantom wallet not connected");
      return false;
    }

    if (legs.length === 0) {
      setError("No legs added to the parlay");
      return false;
    }

    if (betAmount <= 0) {
      setError("Bet amount must be greater than 0");
      return false;
    }

    if (!connection) {
      setError("No connection to Solana network");
      return false;
    }

    try {
      setIsTransacting(true);
      setTransactionStatus("Preparing transaction...");
      setError(""); // Clear any previous errors

      // Get user public key from Phantom
      console.log("Getting public key from phantom...");
      const fromPubkey = window.solana.publicKey;
      console.log("Got public key:", fromPubkey.toString());
      
      // Parse treasury wallet address
      console.log("Using treasury wallet:", TREASURY_WALLET);
      
      if (TREASURY_WALLET === "YOUR_TREASURY_WALLET_ADDRESS") {
        throw new Error("Please set a valid treasury wallet address before placing bets");
      }
      
      const toPubkey = new web3.PublicKey(TREASURY_WALLET);
      
      // Create a transaction
      console.log("Creating transaction with amount:", betAmount);
      const transaction = new web3.Transaction().add(
        // Create a transfer instruction
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(betAmount * 1e9), // Convert SOL to lamports, ensure it's an integer
        })
      );

      // Create a memo instruction with bet data
      const betData = {
        legs: legs.map(leg => ({
          asset: leg.asset,
          timeframe: leg.timeframe,
          lowerBound: leg.lowerBound,
          upperBound: leg.upperBound,
          priceAtAdd: leg.priceAtAdd
        })),
        odds: parlayOdds,
        timestamp: Date.now()
      };

      console.log("Adding memo with bet data:", betData);
      // Use SPL Memo Program for transaction memo
      const encodedData = new TextEncoder().encode(JSON.stringify(betData).substring(0, 500));
      const memoInstruction = new web3.TransactionInstruction({
        keys: [],
        programId: new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: encodedData
      });
      transaction.add(memoInstruction);

      // Try to get recent blockhash
      let blockhash;
      try {
        setTransactionStatus("Getting recent blockhash...");
        console.log("Fetching recent blockhash...");
        const result = await connection.getRecentBlockhash();
        console.log("Got blockhash result:", result);
        blockhash = result.blockhash;
        console.log("Using blockhash:", blockhash);
      } catch (err) {
        console.error("Failed to get recent blockhash:", err);
        setTransactionStatus("RPC endpoint failed. Trying next one...");
        
        // Try next RPC endpoint
        tryAlternativeRpcEndpoint();
        
        // Abort this attempt and let the user try again
        setIsTransacting(false);
        setError("Connection failed. Switched to new RPC endpoint. Please try again.");
        return false;
      }

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign and send transaction
      setTransactionStatus("Awaiting wallet approval...");
      console.log("Requesting transaction signature...");
      
      let signed;
      try {
        signed = await window.solana.signTransaction(transaction);
        console.log("Transaction signed:", signed);
      } catch (signError) {
        console.error("Error signing transaction:", signError);
        setError("Transaction signing failed: " + signError.message);
        setIsTransacting(false);
        return false;
      }
      
      // Send the transaction
      setTransactionStatus("Sending transaction to Solana...");
      let signature;
      try {
        console.log("Sending raw transaction...");
        signature = await connection.sendRawTransaction(signed.serialize());
        console.log("Transaction sent! Signature:", signature);
      } catch (sendError) {
        console.error("Error sending transaction:", sendError);
        
        // Try next RPC endpoint
        tryAlternativeRpcEndpoint();
        
        // Abort this attempt and let the user try again
        setIsTransacting(false);
        setError("Failed to send transaction. Switched to new RPC endpoint. Please try again.");
        return false;
      }
      
      // Wait for confirmation
      setTransactionStatus("Confirming transaction...");
      let confirmation;
      try {
        console.log("Waiting for confirmation...");
        confirmation = await connection.confirmTransaction(signature, 'confirmed');
        console.log("Got confirmation:", confirmation);
      } catch (confirmError) {
        console.error("Error confirming transaction:", confirmError);
        
        // We can consider the transaction potentially successful even if we can't confirm it
        setTransactionStatus("Unable to confirm transaction status, but it was submitted successfully. Transaction hash: " + signature);
        
        // Add the bet to history, but mark as pending
        const ticket = {
          legs,
          betAmount,
          timestamp: new Date().toISOString(),
          signature,
          status: 'pending',
          explorerUrl: `https://explorer.solana.com/tx/${signature}`
        };
        
        setHistory([ticket, ...history]);
        setLegs([]);
        setIsTransacting(false);
        return true;
      }
      
      if (confirmation && confirmation.value && confirmation.value.err) {
        console.error("Confirmation has error:", confirmation.value.err);
        throw new Error("Transaction failed: " + confirmation.value.err);
      }

      // Transaction succeeded
      console.log("Transaction confirmed successfully!");
      setTransactionStatus("Transaction confirmed! Signature: " + signature);
      
      // Add bet to history with transaction signature
      const ticket = {
        legs,
        betAmount,
        timestamp: new Date().toISOString(),
        signature,
        status: 'confirmed',
        explorerUrl: `https://explorer.solana.com/tx/${signature}`
      };
      
      setHistory([ticket, ...history]);
      setLegs([]);
      setIsTransacting(false);
      
      // Refresh wallet balance
      try {
        console.log("Refreshing wallet balance...");
        const balance = await connection.getBalance(fromPubkey);
        console.log("Updated balance:", balance);
        setWalletBalance((balance / 1e9).toFixed(2));
      } catch (balanceError) {
        console.error("Failed to refresh balance:", balanceError);
      }
      
      return true;
    } catch (err) {
      console.error("Transaction failed", err);
      setError("Transaction failed: " + err.message);
      setTransactionStatus("Transaction failed");
      setIsTransacting(false);
      return false;
    }
  };

  return (
    <div className="p-4 space-y-6 bg-white text-black min-h-screen flex flex-col items-center">
      <div className="relative w-full max-w-2xl">
        <h1 className="text-4xl font-extrabold text-center">prly.fun</h1>
        <Button
          className="absolute right-0 top-0 text-sm"
          onClick={async () => {
            if (walletAddress) {
              setShowDisconnect(!showDisconnect);
              return;
            }
            await connectWallet();
          }}
        >
          {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} (${walletBalance ?? '?'} SOL)` : "Connect Wallet"}
        </Button>
        {showDisconnect && (
          <div className="absolute right-0 top-10 bg-white border p-2 shadow rounded">
            <Button className="text-sm" onClick={() => {
              setWalletAddress(null);
              setWalletBalance(null);
              setShowDisconnect(false);
            }}>Disconnect</Button>
          </div>
        )}
      </div>
      <div className="w-full max-w-2xl">
        {walletAddress ? (
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-xl font-bold">Parlay Builder</h2>
              <p className="text-sm text-gray-600">Predict that the final price at the end of the selected timeframe will land <strong>within</strong> your chosen price range.</p>
              <div className="grid grid-cols-2 gap-4">
                <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                  {Object.keys(ASSETS).map(key => (
                    <option key={key} value={key}>{ASSETS[key].name}</option>
                  ))}
                </select>
                <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                  {Object.keys(TIMEFRAMES).map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
                <input type="number" placeholder="Lower Bound" value={lowerBound} onChange={e => setLowerBound(parseFloat(e.target.value))} />
                <input type="number" placeholder="Upper Bound" value={upperBound} onChange={e => setUpperBound(parseFloat(e.target.value))} />
              </div>
              <div className="text-sm text-gray-500">
                Allowed range for {selectedAsset} at {timeframe}: {(RANGE_WIDTHS[selectedAsset]?.[timeframe]?.min * 100).toFixed(1)}% – {(RANGE_WIDTHS[selectedAsset]?.[timeframe]?.max * 100).toFixed(1)}%
              </div>
              <div>
                <p className="text-sm text-gray-700">Live {ASSETS[selectedAsset].name} price: ${livePrice ? livePrice.toLocaleString() : "..."}</p>
                {liveVolatility && (
                  <p className="text-sm text-gray-600">Volatility (30-day): {(liveVolatility * 100).toFixed(2)}%</p>
                )}
                {selectedRangePercent && (
                  <p className="text-sm text-gray-600">Selected range width: {selectedRangePercent}% ({rangeDifficultyLabel})</p>
                )}
              </div>
              {error && <p className="text-red-600 font-semibold">{error}</p>}
              <Button onClick={() => {
                const newLeg = { asset: selectedAsset, timeframe, lowerBound, upperBound };
                const width = Math.abs(upperBound - lowerBound) / livePrice;
                const rangeConfig = RANGE_WIDTHS[selectedAsset]?.[timeframe];
                if (!rangeConfig || width < rangeConfig.min || width > rangeConfig.max) {
                  setError(`Invalid range width for ${selectedAsset}. Must be between ${(rangeConfig.min * 100).toFixed(1)}% and ${(rangeConfig.max * 100).toFixed(1)}% of price.`);
                  return;
                }
                setError("");
                setLegs([
                  ...legs,
                  {
                    ...newLeg,
                    id: Date.now(),
                    priceAtAdd: livePrice,
                    volatilityAtAdd: liveVolatility
                  }
                ]);
              }}>Add to Parlay</Button>
              <div className="mt-4">
                <h3 className="font-semibold">Current Ticket:</h3>
                <ul className="text-sm text-gray-900">
                  {legs.length === 0 ? (
                    <li className="text-gray-500">No legs added yet.</li>
                  ) : (
                    legs.map((leg) => {
                      const asset = ASSETS[leg.asset];
                      const legProb = calculateProbability(
                        leg.priceAtAdd,
                        leg.lowerBound,
                        leg.upperBound,
                        leg.volatilityAtAdd,
                        leg.timeframe,
                        asset.marketCapTier
                      );
                      const legOdds = legProb > 0 ? (1 / legProb).toFixed(1) : "N/A";
                      return (
                        <li key={leg.id} className="flex justify-between">
                          <span>
                            {leg.asset} | {leg.timeframe} | ${leg.lowerBound} - ${leg.upperBound} <span className={`ml-2 font-semibold ${((leg.lowerBound + leg.upperBound) / 2) > livePrice ? 'text-green-600' : 'text-red-600'}`}>{((leg.lowerBound + leg.upperBound) / 2) > livePrice ? '↑' : '↓'}</span>
                          </span>
                          <span className="ml-4 text-sm text-gray-500">{legOdds}x</span>
                          <Button className="ml-2 px-2 py-1 text-xs" onClick={() => setLegs(legs.filter(l => l.id !== leg.id))}>Remove</Button>
                        </li>
                      );
                    })
                  )}
                </ul>
                <div className="mt-2 font-medium text-sm text-green-700">
                  Parlay Odds: {parlayOdds.toFixed(2)}x | Win Probability: {(parlayProbability * 100).toFixed(2)}%<br />
                  Total Payout: ${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">SOL</span>
                    <input 
                      type="number" 
                      placeholder="Bet Amount (SOL)" 
                      value={betAmount} 
                      onChange={e => setBetAmount(parseFloat(e.target.value))} 
                      className="border p-1 rounded w-32" 
                    />
                    <Button 
                      onClick={placeBet}
                      disabled={isTransacting || legs.length === 0}
                      className={isTransacting ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {isTransacting ? "Processing..." : 
                       diagnosticInfo.offlineMode ? "Simulate Bet (Offline)" : "Place Bet On-Chain"}
                    </Button>
                  </div>
                </div>
                
                {/* Transaction Status Message */}
                {transactionStatus && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    transactionStatus.includes("failed") || transactionStatus.includes("Failed") 
                      ? "bg-red-100 text-red-700" 
                      : transactionStatus.includes("Confirmed") || transactionStatus.includes("confirmed")
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {transactionStatus}
                  </div>
                )}
                
                {/* Error Message */}
                {error && (
                  <div className="mt-2 p-2 rounded text-sm bg-red-100 text-red-700">
                    Error: {error}
                    {error.includes("Switched to new RPC") && (
                      <div className="mt-1">
                        <Button 
                          onClick={() => setError("")} 
                          className="text-xs py-1 px-2"
                        >
                          Dismiss & Try Again
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Connection Status & Diagnostic Info */}
                <div className="mt-2 text-xs text-gray-700">
                  {/* Helius RPC Status */}
                  <div className="flex justify-between">
                    <span className={diagnosticInfo.connectionStatus === 'connected' ? 'text-green-600' : 'text-gray-700'}>
                      Connected to: Helius RPC
                    </span>
                    <Button 
                      className={`text-xs py-0 px-2 ${
                        diagnosticInfo.connectionStatus === 'connected' 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={testRpcConnection}
                    >
                      Test Connection
                    </Button>
                  </div>
                  
                  {/* Simple connection status */}
                  {diagnosticInfo.connectionStatus === 'connected' && (
                    <div className="mt-1 px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                      ✓ Connected to Solana network via Helius
                    </div>
                  )}
                  
                  {/* Connection failures */}
                  {diagnosticInfo.connectionStatus === 'failed' && (
                    <div className="mt-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
                      Helius RPC connection failed. Please check your API key.
                    </div>
                  )}
                  
                  {/* Advanced diagnostics (click to show) */}
                  {diagnosticInfo.lastError && (
                    <div className="mt-2">
                      <button 
                        onClick={() => setDiagnosticInfo(prev => ({ ...prev, showAdvancedDiagnostics: !prev.showAdvancedDiagnostics }))}
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {diagnosticInfo.showAdvancedDiagnostics ? '▼' : '►'} Show Details
                      </button>
                      
                      {diagnosticInfo.showAdvancedDiagnostics && (
                        <div className="mt-1 p-2 border border-gray-200 bg-gray-50 rounded">
                          <p className="font-semibold">Connection Error:</p>
                          <div className="text-red-600 text-xs p-1 bg-gray-100 rounded overflow-x-auto mt-1">
                            {diagnosticInfo.lastError}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center text-gray-500 font-medium py-8">Please connect your wallet to use the platform.</div>
        )}
      </div>
      <div className="w-full max-w-2xl">
        <Card>
          <CardContent>
            <h2 className="text-xl font-bold mb-4">Bet History</h2>
            <ul className="space-y-2 text-sm text-gray-800">
              {history.length === 0 ? (
                <li className="text-gray-500">No bet history yet.</li>
              ) : (
                history.map((ticket, i) => (
                  <li key={i} className="border-b pb-2">
                    <div><strong>Placed:</strong> {new Date(ticket.timestamp).toLocaleString()}</div>
                    <div><strong>Amount:</strong> {ticket.betAmount} SOL</div>
                    {ticket.signature && (
                      <div>
                        <strong>Transaction:</strong>{" "}
                        <a 
                          href={ticket.explorerUrl || `https://explorer.solana.com/tx/${ticket.signature}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {ticket.signature.slice(0, 8)}...{ticket.signature.slice(-8)}
                        </a>
                      </div>
                    )}
                    <div><strong>Status:</strong> <span className={ticket.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'}>{ticket.status || 'pending'}</span></div>
                    <div><strong>Legs:</strong>
                      <ul className="ml-4 list-disc">
                        {ticket.legs.map((leg, j) => (
                          <li key={j} className={`flex justify-between ${((leg.lowerBound + leg.upperBound) / 2) > livePrice ? 'text-green-600' : 'text-red-600'}`}>
                            <span>{leg.asset} | {leg.timeframe} | ${leg.lowerBound} - ${leg.upperBound}</span>
                            <span className="ml-2 font-bold">{((leg.lowerBound + leg.upperBound) / 2) > livePrice ? '↑' : '↓'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
