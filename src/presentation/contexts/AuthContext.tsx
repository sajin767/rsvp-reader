import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { firebaseAuth, firebaseConfigError } from '../../data/firebase/client';

const PENDING_EMAIL_KEY = 'rsvp_sync_pending_email';

interface AuthContextType {
  user: User | null;
  email: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  configError: string | null;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLink: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function getContinueUrl() {
  return `${window.location.origin}/settings`;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) {
      setIsLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  const completeEmailLink = useCallback(async (email?: string) => {
    if (!firebaseAuth) {
      throw new Error(firebaseConfigError || 'Firebase is not configured.');
    }

    if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      return;
    }

    const pendingEmail = email || localStorage.getItem(PENDING_EMAIL_KEY);
    if (!pendingEmail) {
      throw new Error('Enter the same email address used to request the sign-in link.');
    }

    await signInWithEmailLink(firebaseAuth, pendingEmail, window.location.href);
    localStorage.removeItem(PENDING_EMAIL_KEY);
    window.history.replaceState({}, document.title, getContinueUrl());
  }, []);

  useEffect(() => {
    if (!firebaseAuth || !isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      return;
    }

    const pendingEmail = localStorage.getItem(PENDING_EMAIL_KEY);
    if (!pendingEmail) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void completeEmailLink(pendingEmail).finally(() => {
      setIsLoading(false);
    });
  }, [completeEmailLink]);

  const sendEmailLink = useCallback(async (email: string) => {
    if (!firebaseAuth) {
      throw new Error(firebaseConfigError || 'Firebase is not configured.');
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new Error('Enter an email address.');
    }

    await sendSignInLinkToEmail(firebaseAuth, normalizedEmail, {
      url: getContinueUrl(),
      handleCodeInApp: true,
      android: {
        packageName: 'com.rsvpreader.app',
        installApp: false,
      },
    });
    localStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
  }, []);

  const signOut = useCallback(async () => {
    if (!firebaseAuth) {
      return;
    }
    await firebaseSignOut(firebaseAuth);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    email: user?.email || null,
    isAuthenticated: Boolean(user),
    isLoading,
    configError: firebaseConfigError,
    sendEmailLink,
    completeEmailLink,
    signOut,
  }), [completeEmailLink, isLoading, sendEmailLink, signOut, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
