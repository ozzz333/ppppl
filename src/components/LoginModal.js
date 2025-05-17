import React, { useState, useEffect } from 'react';
import { getCurrentUser, loginWithEmail, signUpWithEmail, logoutUser, linkWalletToUser, findUserByWallet } from '../firebase';

const LoginModal = ({ isOpen, onClose, onLogin, walletAddress }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      // Check if this wallet is already associated with an account
      const checkWalletAssociation = async () => {
        try {
          const user = await findUserByWallet(walletAddress);
          if (user) {
            console.log("Found user account associated with this wallet:", user);
            // Could automatically log the user in here if desired
          }
        } catch (err) {
          console.error("Error checking wallet association:", err);
        }
      };
      
      checkWalletAssociation();
    }
  }, [walletAddress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      let user;
      
      if (isSignUp) {
        // Sign up new user
        user = await signUpWithEmail(email, password);
        
        // Link wallet if connected
        if (walletAddress && user) {
          await linkWalletToUser(user.uid, walletAddress);
        }
      } else {
        // Login existing user
        user = await loginWithEmail(email, password);
      }
      
      // Notify parent component of successful login
      onLogin(user);
      onClose();
    } catch (error) {
      console.error("Auth error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{isSignUp ? 'Create Account' : 'Login'}</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded w-full py-2 px-3"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded w-full py-2 px-3"
              required
            />
          </div>
          
          {walletAddress && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
              Your wallet ({walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}) will be linked to this account.
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={loading}
            >
              {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Login'}
            </button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
            </button>
          </div>
        </form>
        
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;