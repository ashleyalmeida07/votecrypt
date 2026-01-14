import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, RecaptchaVerifier as FirebaseRecaptchaVerifier, signInWithPhoneNumber as firebaseSignInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Verify auth is properly initialized
if (!auth) {
  console.error('Firebase auth failed to initialize. Config:', firebaseConfig);
  throw new Error('Firebase authentication initialization failed');
}

const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider, FirebaseRecaptchaVerifier as RecaptchaVerifier, firebaseSignInWithPhoneNumber as signInWithPhoneNumber };
