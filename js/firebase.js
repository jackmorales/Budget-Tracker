// ============================================================
// FIREBASE INITIALISATION
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCW1KVo3mAnEmKXg_tOwPMVoxdilTdJgFs",
  authDomain: "budget-tracker-70a9a.firebaseapp.com",
  projectId: "budget-tracker-70a9a",
  storageBucket: "budget-tracker-70a9a.firebasestorage.app",
  messagingSenderId: "293070949932",
  appId: "1:293070949932:web:76bae54711da784978cb89",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-export auth helpers
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};

// Re-export Firestore helpers
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
};
