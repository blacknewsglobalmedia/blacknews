import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  setLogLevel,
  doc, 
  getDoc,
  collection,
  onSnapshot,
  setDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Silence verbose internal connection warnings from Firestore during offline or initial connection negotiation
try {
  setLogLevel('silent');
} catch {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use initializeFirestore with experimentalForceLongPolling to prevent WebChannel drops in proxy/iframe environments
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Non-blocking utility to verify Firestore status if explicitly invoked
export async function testConnection(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'test', 'connection'));
    return snap.exists();
  } catch {
    return false;
  }
}
export { collection, doc, getDoc, onSnapshot, setDoc, getDocs, writeBatch, signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
