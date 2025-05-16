      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLoginSuccess}
        walletAddress={walletAddress}
      />  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser);
      
      if (authUser) {
        console.log("User signed in:", authUser.uid);
        // Load data from Firebase when user signs in
        loadUserData(authUser.uid);
      } else {
        console.log("User signed out");
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);
  
  // Sync data with Firebase when user is authenticated
  const syncWithFirebase = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setSyncStatus({ status: 'error', message: 'Please login to sync your data' });
      setShowLoginModal(true);
      return;
    }
    
    try {
      setSyncStatus({ status: 'syncing', message: 'Syncing data...' });
      
      // Save bet history to Firebase
      await saveBetHistory(currentUser.uid, history);
      
      // Save current parlay state
      await saveCurrentParlay(currentUser.uid, {
        legs,
        selectedAsset,
        timeframe,
        lowerBound,
        upperBound,
        betAmount
      });
      
      // Link wallet if not already linked
      if (walletAddress) {
        await linkWalletToUser(currentUser.uid, walletAddress);
      }
      
      setSyncStatus({ status: 'success', message: 'Data synced successfully!' });
      
      // Clear status after 3 seconds
      setTimeout(() => {
        setSyncStatus({ status: '', message: '' });
      }, 3000);
      
    } catch (error) {
      console.error("Error syncing with Firebase:", error);
      setSyncStatus({ status: 'error', message: 'Sync failed: ' + error.message });
    }
  };
  
  // Load user data from Firebase
  const loadUserData = async (userId) => {
    try {
      setSyncStatus({ status: 'loading', message: 'Loading your data...' });
      
      // Load bet history
      const loadedHistory = await loadBetHistory(userId);
      if (loadedHistory && loadedHistory.length > 0) {
        setHistory(loadedHistory);
      }
      
      // Load current parlay
      const parlayData = await loadCurrentParlay(userId);
      if (parlayData) {
        if (parlayData.legs) setLegs(parlayData.legs);
        if (parlayData.selectedAsset) setSelectedAsset(parlayData.selectedAsset);
        if (parlayData.timeframe) setTimeframe(parlayData.timeframe);
        if (parlayData.lowerBound) setLowerBound(parlayData.lowerBound);
        if (parlayData.upperBound) setUpperBound(parlayData.upperBound);
        if (parlayData.betAmount) setBetAmount(parlayData.betAmount);
      }
      
      setSyncStatus({ status: 'success', message: 'Data loaded successfully!' });
      
      // Clear status after 3 seconds
      setTimeout(() => {
        setSyncStatus({ status: '', message: '' });
      }, 3000);
      
    } catch (error) {
      console.error("Error loading user data:", error);
      setSyncStatus({ status: 'error', message: 'Failed to load data: ' + error.message });
    }
  };
  
  // Handle login success
  const handleLoginSuccess = (authUser) => {
    setUser(authUser);
    // Load user data after successful login
    loadUserData(authUser.uid);
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      setError("Logout failed: " + error.message);
    }
  };  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: '', message: '' });  // Handle wallet persistence
  useEffect(() => {
    // Store wallet connection info if available
    if (walletAddress) {
      localStorage.setItem('parlayWalletConnected', 'true');
    }
  }, [walletAddress]);
  
  // Attempt to reconnect wallet on page load if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem('parlayWalletConnected') === 'true';
    
    if (wasConnected && window.solana && window.solana.isPhantom && !walletAddress) {
      // Try to reconnect if wallet was previously connected
      console.log("Attempting to reconnect wallet...");
      connectWallet().catch(err => {
        console.log("Could not auto-reconnect wallet:", err);
        // If reconnection fails, clear the stored connection state
        localStorage.removeItem('parlayWalletConnected');
      });
    }
  }, []);  // Clear saved data function
  const clearSavedData = () => {
    // Show confirmation dialog
    if (window.confirm("Are you sure you want to clear all saved data?")) {
      // Clear localStorage
      localStorage.removeItem('parlayHistory');
      localStorage.removeItem('parlayLegs');
      localStorage.removeItem('parlayBetAmount');
      localStorage.removeItem('parlaySelectedAsset');
      localStorage.removeItem('parlayTimeframe');
      localStorage.removeItem('parlayLowerBound');
      localStorage.removeItem('parlayUpperBound');
      
      // Reset state
      setHistory([]);
      setLegs([]);
      setBetAmount(100);
      setSelectedAsset("BTC");
      setTimeframe("24-hour");
      setLowerBound(0);
      setUpperBound(0);
      
      // Show confirmation
      alert("All saved data has been cleared.");
    }
  };  // Save history to Firebase when authenticated user exists
  useEffect(() => {
    if (user && history.length > 0) {
      // Save to localStorage
      localStorage.setItem('parlayHistory', JSON.stringify(history));
      
      // If we have an authenticated user, save to Firebase as well
      // But don't do it on every change to avoid excessive writes
      const timeoutId = setTimeout(() => {
        saveBetHistory(user.uid, history)
          .then(() => console.log("Bet history saved to Firebase"))
          .catch(err => console.error("Error saving bet history to Firebase:", err));
      }, 2000); // Wait 2 seconds after last change before saving
      
      return () => clearTimeout(timeoutId);
    } else if (history.length > 0) {
      // No authenticated user, just save to localStorage
      localStorage.setItem('parlayHistory', JSON.stringify(history));
    }
  }, [history, user]);
  
  // Save current legs whenever they change
  useEffect(() => {
    localStorage.setItem('parlayLegs', JSON.stringify(legs));
  }, [legs]);
  
  // Save bet amount whenever it changes
  useEffect(() => {
    localStorage.setItem('parlayBetAmount', betAmount.toString());
  }, [betAmount]);
  
  // Save selected asset and timeframe
  useEffect(() => {
    localStorage.setItem('parlaySelectedAsset', selectedAsset);
  }, [selectedAsset]);
  
  useEffect(() => {
    localStorage.setItem('parlayTimeframe', timeframe);
  }, [timeframe]);
  
  // Save bounds
  useEffect(() => {
    localStorage.setItem('parlayLowerBound', lowerBound.toString());
  }, [lowerBound]);
  
  useEffect(() => {
    localStorage.setItem('parlayUpperBound', upperBound.toString());
  }, [upperBound]);  // Test RPC connection when component mounts
  useEffect(() => {
    // Wait a moment before testing connection
    const timer = setTimeout(() => {
      testRpcConnection();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);import React, { useState, useMemo, useEffect } from 'react';
import * as web3 from '@solana/web3.js';
import { getCurrentUser, onAuthChange, saveBetHistory, loadBetHistory, saveCurrentParlay, loadCurrentParlay, linkWalletToUser } from '../firebase';
import LoginModal from './LoginModal';

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
  const [retryCount, setRetryCount] = useState(0);
  const [diagnosticInfo, setDiagnosticInfo] = useState({});

  // Treasury wallet address where bets will be sent
  const TREASURY_WALLET = "DQeRRYooThKaTY4XZyeiFFpPnrqLSrdmEGhJzXpXYswg"; // Replace with your actual treasury wallet address
  
  // Single reliable RPC endpoint
  const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=8ec3eb2e-80c7-4681-9ae7-f6f96a6385ee";

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

  // Direct RPC fetch method (uses Helius endpoint)
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
  };

  // Testing the RPC connection (simplified for single endpoint)
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
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      
      try {
        if (connection) {
          const balance = await connection.getBalance(response.publicKey);
          setWalletBalance((balance / 1e9).toFixed(2));
        } else {
          setError("Failed to connect to Solana network. Please try again.");
        }
      } catch (err) {
        console.error("Failed to get balance:", err);
        setError("Failed to get wallet balance. Please try again.");
      }
    } catch (error) {
      console.error("User denied wallet connection", error);
      setError("Wallet connection was denied.");
    }
  };

  // Auto-connect to wallet if already authorized
  useEffect(() => {
    if (window.solana && window.solana.isPhantom && connection) {
      window.solana.connect({ onlyIfTrusted: true })
        .then(async (res) => {
          const address = res.publicKey.toString();
          setWalletAddress(address);
          try {
            const balance = await connection.getBalance(res.publicKey);
            setWalletBalance((balance / 1e9).toFixed(2));
          } catch (err) {
            console.error("Failed to get balance:", err);
          }
        })
        .catch(() => {
          // Silent fail if not previously trusted
        });
    }
  }, [connection]);

  // State persistence using localStorage
  useEffect(() => {
    // Load saved data when component mounts
    const loadSavedData = () => {
      try {
        // Load bet history
        const savedHistory = localStorage.getItem('parlayHistory');
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        }
        
        // Load current legs
        const savedLegs = localStorage.getItem('parlayLegs');
        if (savedLegs) {
          setLegs(JSON.parse(savedLegs));
        }
        
        // Load bet amount
        const savedBetAmount = localStorage.getItem('parlayBetAmount');
        if (savedBetAmount) {
          setBetAmount(parseFloat(savedBetAmount));
        }
        
        // Load selected asset and timeframe
        const savedAsset = localStorage.getItem('parlaySelectedAsset');
        if (savedAsset) {
          setSelectedAsset(savedAsset);
        }
        
        const savedTimeframe = localStorage.getItem('parlayTimeframe');
        if (savedTimeframe) {
          setTimeframe(savedTimeframe);
        }
        
        // Load bounds
        const savedLowerBound = localStorage.getItem('parlayLowerBound');
        if (savedLowerBound) {
          setLowerBound(parseFloat(savedLowerBound));
        }
        
        const savedUpperBound = localStorage.getItem('parlayUpperBound');
        if (savedUpperBound) {
          setUpperBound(parseFloat(savedUpperBound));
        }
        
        console.log("Loaded saved data from localStorage");
      } catch (err) {
        console.error("Error loading saved data:", err);
      }
    };
    
    loadSavedData();
  }, []);

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

      // Get user public key
      const fromPubkey = window.solana.publicKey;
      
      // Parse treasury wallet address
      console.log("Using treasury wallet:", TREASURY_WALLET);
      
      if (TREASURY_WALLET === "YOUR_TREASURY_WALLET_ADDRESS") {
        throw new Error("Please set a valid treasury wallet address before placing bets");
      }
      
      const toPubkey = new web3.PublicKey(TREASURY_WALLET);
      
      // Create a transaction
      const transaction = new web3.Transaction().add(
        // Create a transfer instruction
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(betAmount * 1e9), // Convert SOL to lamports
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
        
        // First try with the Web3.js connection
        const result = await connection.getRecentBlockhash();
        blockhash = result.blockhash;
        console.log("Got blockhash via Web3.js:", blockhash);
      } catch (err) {
        console.error("Failed to get recent blockhash via Web3.js:", err);
        
        // Fallback to direct RPC call
        setTransactionStatus("Trying direct RPC call for blockhash...");
        const directResult = await directRpcCall('getRecentBlockhash');
        blockhash = directResult.blockhash;
        console.log("Got blockhash via direct RPC:", blockhash);
      }

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign and send transaction
      setTransactionStatus("Awaiting wallet approval...");
      console.log("Requesting transaction signature...");
      const signed = await window.solana.signTransaction(transaction);
      console.log("Transaction signed:", signed);
      
      setTransactionStatus("Sending transaction to Solana...");
      let signature;
      try {
        console.log("Sending raw transaction via Web3.js...");
        signature = await connection.sendRawTransaction(signed.serialize());
        console.log("Transaction sent! Signature:", signature);
      } catch (sendError) {
        console.error("Error sending transaction via Web3.js:", sendError);
        
        // Fallback to direct RPC call
        console.log("Trying to send via direct RPC call...");
        const serializedTx = signed.serialize();
        const encodedTx = Buffer.from(serializedTx).toString('base64');
        
        signature = await directRpcCall('sendTransaction', [
          encodedTx,
          { encoding: 'base64' }
        ]);
        console.log("Transaction sent via direct RPC! Signature:", signature);
      }
      
      // Wait for confirmation
      setTransactionStatus("Confirming transaction...");
      let confirmed = false;
      let attempts = 0;
      
      while (!confirmed && attempts < 20) {
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
        setTransactionStatus(`Confirming transaction... (attempt ${attempts}/20)`);
      }

      // Whether confirmed or not, add to history 
      const confirmationStatus = confirmed ? 'confirmed' : 'pending';
      setTransactionStatus(`Transaction ${confirmationStatus}! Signature: ${signature}`);
      
      const ticket = {
        legs,
        betAmount,
        timestamp: new Date().toISOString(),
        signature,
        status: confirmationStatus,
        explorerUrl: `https://explorer.solana.com/tx/${signature}`
      };
      
      setHistory([...history, ticket]);
      setLegs([]);
      setIsTransacting(false);
      
      // Refresh wallet balance
      try {
        const balance = await connection.getBalance(fromPubkey);
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
      
      if (TREASURY_WALLET === "YOUR_TREASURY_WALLET_ADDRESS") {
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
          
          setHistory([...history, ticket]);
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
  };

  // Place bet with multiple fallback methods
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
      
      setHistory([...history, ticket]);
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
  };

  return (
    <div className="p-4 space-y-6 bg-white text-black min-h-screen flex flex-col items-center">
      <div className="relative w-full max-w-2xl">
        <h1 className="text-4xl font-extrabold text-center">prly.fun</h1>
        <div className="absolute right-0 top-0 flex items-center">
          {user ? (
            <div className="flex items-center mr-4">
              <span className="text-xs text-gray-600 mr-2">
                {user.email}
              </span>
              <Button 
                className="text-xs py-1 px-2 bg-gray-200 text-gray-700 hover:bg-gray-300 mr-2"
                onClick={syncWithFirebase}
              >
                Sync Data
              </Button>
              <Button 
                className="text-xs py-1 px-2 bg-red-100 text-red-700 hover:bg-red-200"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Button 
              className="text-xs py-1 px-2 mr-2 bg-green-100 text-green-700 hover:bg-green-200"
              onClick={() => setShowLoginModal(true)}
            >
              Login / Signup
            </Button>
          )}
          <Button
            className="text-sm"
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
        </div>
        {showDisconnect && (
          <div className="absolute right-0 top-10 bg-white border p-2 shadow rounded">
            <Button className="text-sm" onClick={() => {
              setWalletAddress(null);
              setWalletBalance(null);
              setShowDisconnect(false);
              localStorage.removeItem('parlayWalletConnected');
            }}>Disconnect</Button>
          </div>
        )}
        
        {/* Sync Status Message */}
        {syncStatus.message && (
          <div className={`absolute left-0 top-12 px-3 py-1 rounded text-xs ${
            syncStatus.status === 'success' ? 'bg-green-100 text-green-700' :
            syncStatus.status === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {syncStatus.message}
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
                    <div><strong>Status:</strong> <span className={ticket.status === 'confirmed' ? 'text-green-600' : ticket.status === 'simulated' ? 'text-blue-600' : 'text-yellow-600'}>{ticket.status || 'pending'}</span></div>
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
