import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthSession, PortalUser } from '../types';
import { DEMO_USERS } from '../lib/mockData';
import { storageGet, storageRemove, storageSet, STORAGE_KEYS } from '../lib/storage';

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  user: PortalUser | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const stored = storageGet<AuthSession>(STORAGE_KEYS.SESSION);
    if (stored) setSession(stored);
  }, []);

  const login = (email: string, password: string): { success: boolean; error?: string } => {
    const found = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { success: false, error: 'Invalid email or password.' };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...user } = found;
    const newSession: AuthSession = { user, loginTime: new Date().toISOString() };
    setSession(newSession);
    storageSet(STORAGE_KEYS.SESSION, newSession);
    return { success: true };
  };

  const logout = () => {
    setSession(null);
    storageRemove(STORAGE_KEYS.SESSION);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        user: session?.user ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
