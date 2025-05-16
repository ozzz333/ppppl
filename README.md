# Crypto Parlay Website

A decentralized application for placing crypto parlays using Solana.

## Features

- Connect with Phantom wallet
- Create parlay bets on cryptocurrency price movements
- On-chain transactions for bet placement
- View bet history with transaction links

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Build for production:
   ```
   npm run build
   ```

## Configuration

Before using the application, make sure to:

1. Replace the treasury wallet address in `src/components/ParlayBuilder.js` with your own Solana wallet address:
   ```javascript
   // Find this line and replace with your wallet address
   const TREASURY_WALLET = "YOUR_TREASURY_WALLET_ADDRESS";
   ```

2. Install the Phantom wallet browser extension

## Requirements

- Node.js v14+
- npm or yarn
- Phantom Wallet browser extension

## How It Works

1. Connect your Phantom wallet
2. Select a cryptocurrency asset, timeframe, and price range
3. Add one or more "legs" to your parlay
4. Set your bet amount in SOL
5. Place your bet on-chain
6. Track your bet history and transaction confirmations

## License

MIT