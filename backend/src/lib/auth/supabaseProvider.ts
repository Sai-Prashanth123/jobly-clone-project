// Supabase Auth implementation - the behaviour the app has today.
//
// Kept as a first-class provider rather than deleted: it is what Render still
// runs on, and it is the rollback path if anything about Cognito misbehaves in
// production. AUTH_DRIVER selects between them.
import { supabaseAdmin, supabaseAnon } from '../../config/supabase';
import { InvalidCredentialsError, type AuthProvider, type AuthSession } from './types';

export const supabaseAuthProvider: AuthProvider = {
  name: 'supabase',

  async signIn(email, password) {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new InvalidCredentialsError(error?.message ?? 'Invalid credentials');
    }
    return {
      userId: data.user.id,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  },

  async verifyToken(token) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new InvalidCredentialsError('Invalid or expired token');
    return { userId: user.id };
  },

  async refresh(refreshToken): Promise<AuthSession> {
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) throw new InvalidCredentialsError('Session expired or invalid');
    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0,
    };
  },

  async signOut() {
    // Supabase's signOut acts on the client's own session, which on the server
    // is nobody's. Kept as a no-op for parity; the frontend discards the token.
    await supabaseAnon.auth.signOut();
  },

  async createUser({ email, password }) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data?.user) throw error ?? new Error('Failed to create auth user');
    return { userId: data.user.id };
  },

  async setPassword(userId, password) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  },

  async setEmail(userId, email) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (error) throw error;
  },

  async deleteUser(userId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
};
