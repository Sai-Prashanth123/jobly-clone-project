import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthSession, PortalUser } from '../types';
import { apiClient } from '../lib/apiClient';

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  user: PortalUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'jobly_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem('access_token', (session as AuthSession & { token?: string }).token ?? '');
    }
  }, [session]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      const { token, user } = data.data;

      // Store token for interceptor
      sessionStorage.setItem('access_token', token);

      const newSession: AuthSession & { token: string } = {
        user,
        loginTime: new Date().toISOString(),
        token,
      };
      setSession(newSession);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));

      return { success: true };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Invalid credentials. Please try again.';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    apiClient.post('/auth/logout').catch(() => {});
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('access_token');
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
