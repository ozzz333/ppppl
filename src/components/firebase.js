// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration
// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAA4PLlumcvp2SI5Ao9Co6L3nUVQFjE-wg",
  authDomain: "prrrr-8f272.firebaseapp.com",
  projectId: "prrrr-8f272",
  storageBucket: "prrrr-8f272.firebasestorage.app",
  messagingSenderId: "219385374910",
  appId: "1:219385374910:web:4d9d17d45dddd51af496ef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Authentication functions
export const signUpWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Create a user profile document in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: email,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Update last login timestamp
    await updateDoc(doc(db, "users", userCredential.user.uid), {
      lastLogin: serverTimestamp()
    });
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

// Set up auth state listener
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Database functions for bets
export const saveBetHistory = async (userId, history) => {
  try {
    await setDoc(doc(db, "betHistory", userId), {
      bets: history,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving bet history:", error);
    throw error;
  }
};

export const loadBetHistory = async (userId) => {
  try {
    const docRef = doc(db, "betHistory", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data().bets;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading bet history:", error);
    throw error;
  }
};

// Save current parlay state
export const saveCurrentParlay = async (userId, parlayData) => {
  try {
    await setDoc(doc(db, "currentParlays", userId), {
      ...parlayData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Error saving current parlay:", error);
    throw error;
  }
};

export const loadCurrentParlay = async (userId) => {
  try {
    const docRef = doc(db, "currentParlays", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error loading current parlay:", error);
    throw error;
  }
};

// Associate wallet address with user account
export const linkWalletToUser = async (userId, walletAddress) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      walletAddress: walletAddress,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Error linking wallet to user:", error);
    throw error;
  }
};

// Find user by wallet address
export const findUserByWallet = async (walletAddress) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("walletAddress", "==", walletAddress));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return { ...userData, id: querySnapshot.docs[0].id };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error finding user by wallet:", error);
    throw error;
  }
};

export default { auth, db };