import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthSession, PortalUser } from '../types';
import { apiClient } from '../lib/apiClient';
import { queryClient } from '../lib/queryClient';

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
      // Distinguish a genuine bad password (401) from a transient backend
      // problem (cold start / timeout / 5xx). The old code showed "Invalid
      // credentials" for everything, so a server that was merely waking up
      // looked like a wrong password.
      const e = err as { response?: { status?: number; data?: { error?: string } }; request?: unknown; code?: string };
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.error;
      let msg: string;
      if (status === 401) {
        msg = serverMsg ?? 'Invalid email or password. Please try again.';
      } else if (!e?.response) {
        // No response = network error / timeout / DNS — usually the app is
        // cold-starting on the free tier.
        msg = "Can't reach the server — it may be waking up. Please wait a few seconds and try again.";
      } else if (status && status >= 500) {
        msg = 'The server had a problem (it may be starting up). Please try again in a moment.';
      } else {
        msg = serverMsg ?? 'Sign-in failed. Please try again.';
      }
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    apiClient.post('/auth/logout').catch(err => console.warn('[auth] logout endpoint failed', err));
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('access_token');
    // Clear cached query data so the next user (on a shared device) doesn't
    // see the previous user's data flash before refetch.
    queryClient.clear();
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
