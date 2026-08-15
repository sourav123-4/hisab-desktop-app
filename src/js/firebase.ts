import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  Auth,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Firestore
} from 'firebase/firestore';

const STORAGE_KEY_FIREBASE_CONFIG = 'daily_hisab_firebase_custom_config';

export function getStoredFirebaseConfig(): Record<string, string> {
  const env: Record<string, string> = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  try {
    const custom = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && parsed.projectId) {
        return {
          ...parsed,
          googleClientId: parsed.googleClientId || parsed.clientId || env.VITE_GOOGLE_CLIENT_ID || env.VITE_FIREBASE_GOOGLE_CLIENT_ID || '',
          googleClientSecret: parsed.googleClientSecret || parsed.clientSecret || env.VITE_GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || ''
        };
      }
    }
  } catch (e) { }

  return {
    apiKey: env.VITE_FIREBASE_WEB_API_KEY || env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_WEB_APP_ID || env.VITE_FIREBASE_APP_ID || '',
    googleClientId: env.VITE_GOOGLE_CLIENT_ID || env.VITE_FIREBASE_GOOGLE_CLIENT_ID || '',
    googleClientSecret: env.VITE_GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || ''
  };
}

export function saveFirebaseConfig(config: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
    if (typeof window !== 'undefined') window.location.reload();
  } catch (e) {
    console.error('Failed to save custom Firebase config', e);
  }
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

try {
  const config = getStoredFirebaseConfig();
  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
} catch (err: any) {
  console.warn('[Firebase Init Warning]', err.message);
}

export async function registerWithEmail(email: string, password: string, displayName: string = ''): Promise<User> {
  if (!auth) throw new Error('Firebase auth not initialized');
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && userCred.user) {
    await updateProfile(userCred.user, { displayName });
  }
  return userCred.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase auth not initialized');
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
}

export async function loginWithGoogle(): Promise<User> {
  if (!auth) throw new Error('Firebase auth not initialized');

  if (typeof window !== 'undefined' && window.electronAPI?.openExternalUrl) {
    const authUrl = 'http://localhost:5173/google-auth.html';
    await window.electronAPI.openExternalUrl(authUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Google Authentication timed out or window closed.'));
      }, 120000);

      window.electronAPI!.onGoogleAuthSuccess(async (payload: any) => {
        clearTimeout(timeout);
        try {
          if (payload?.error) {
            reject(new Error(payload.error));
            return;
          }
          if (payload && (payload.idTokenCred || payload.accessTokenCred || payload.idToken || payload.accessToken)) {
            const googleIdToken = payload.idTokenCred || null;
            const googleAccessToken = payload.accessTokenCred || payload.accessToken || null;

            try {
              let credential = null;
              if (googleIdToken && googleAccessToken) {
                credential = GoogleAuthProvider.credential(googleIdToken, googleAccessToken);
              } else if (googleIdToken) {
                credential = GoogleAuthProvider.credential(googleIdToken);
              } else if (googleAccessToken) {
                credential = GoogleAuthProvider.credential(null, googleAccessToken);
              }

              if (credential) {
                const userCred = await signInWithCredential(auth!, credential);
                resolve(userCred.user);
                return;
              }
            } catch (e1: any) {
              console.warn('[Google OAuth Token Warning]:', e1.message);
              if (googleAccessToken) {
                try {
                  const credential = GoogleAuthProvider.credential(null, googleAccessToken);
                  const userCred = await signInWithCredential(auth!, credential);
                  resolve(userCred.user);
                  return;
                } catch (e2) {}
              }
            }

            if (auth!.currentUser && !auth!.currentUser.isAnonymous) {
              resolve(auth!.currentUser);
              return;
            }
          }
          reject(new Error('Google authentication payload invalid'));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  const userCred = await signInWithPopup(auth, provider);
  return userCred.user;
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase auth not initialized');
  await sendPasswordResetEmail(auth, email);
}

export function getCurrentUser(): User | null {
  return auth?.currentUser || null;
}

export function onAuthChange(callback: (user: User | null) => void): (() => void) {
  if (!auth) return () => { };
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth!).catch(() => { });
    }
    callback(user);
  });
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
