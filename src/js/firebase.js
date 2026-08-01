import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';

const STORAGE_KEY_FIREBASE_CONFIG = 'daily_hisab_firebase_custom_config';

export function getStoredFirebaseConfig() {
  // 1. Check custom user override in localStorage
  try {
    const custom = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && parsed.projectId) return parsed;
    }
  } catch (e) {}

  // 2. Read from Vite Environment Variables (.env)
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || ''
  };
}

export function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
    window.location.reload();
  } catch (e) {
    console.error('Failed to save custom Firebase config', e);
  }
}

let app;
let db;
let auth;

try {
  const config = getStoredFirebaseConfig();
  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);

  // Authenticate silently if unauthenticated
  signInAnonymously(auth).then(() => {
    console.log('[Firebase Auth] Signed in anonymously to taskmanager-bbf73');
  }).catch((err) => {
    if (err.code === 'auth/admin-restricted-operation') {
      console.warn('[Firebase Auth] Anonymous sign-in is disabled in Firebase Console. Proceeding without auth token.');
    } else {
      console.warn('[Firebase Auth Warning]', err.message);
    }
  });
} catch (err) {
  console.warn('[Firebase Init Warning]', err.message);
}

export { 
  app, 
  db, 
  auth,
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
};
