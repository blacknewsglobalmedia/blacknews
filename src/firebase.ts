import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  doc, 
  getDoc,
  getDocFromServer,
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use initializeFirestore with experimentalForceLongPolling to prevent WebChannel connection drops in proxy/cloud environments
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

// Validate connection to Firestore as required by Firebase skill
export async function testConnection() {
  try {
    await getDoc(doc(db, 'test', 'connection'));
    console.log('[BLACKNEWS] Conexión establecida con Firestore Cloud.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[BLACKNEWS] Firestore operando con persistencia local.');
    }
  }
}

// Call testConnection safely in the background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection();
  }, 500);
}
