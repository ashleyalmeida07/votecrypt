"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  ConfirmationResult,
} from 'firebase/auth';
import { auth, googleProvider, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phoneNumber: string, recaptchaVerifier: any) => Promise<ConfirmationResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithPhone: async () => ({} as ConfirmationResult),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Sync user to database
        try {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName,
              photoUrl: firebaseUser.photoURL,
            }),
          });
        } catch (error) {
          console.error('Failed to sync user to database:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithPhone = async (phoneNumber: string, recaptchaVerifier: any): Promise<ConfirmationResult> => {
    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized')
      }
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Invalid phone number')
      }
      
      // Validate phone number format for India
      const phoneRegex = /^\+91[6-9]\d{9}$/
      if (!phoneRegex.test(phoneNumber)) {
        throw new Error('Invalid Indian phone number format. Expected: +91XXXXXXXXXX')
      }
      
      console.log('Attempting to sign in with phone:', phoneNumber)
      
      // For testing without reCAPTCHA (development only)
      // In production, you MUST use reCAPTCHA or App Check
      throw new Error('Phone authentication requires reCAPTCHA verification. This feature needs Firebase App Check or reCAPTCHA to be properly configured for production use.')
      
    } catch (error: any) {
      console.error('Error signing in with phone:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithPhone, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
