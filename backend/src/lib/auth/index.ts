// Picks the identity backend. AUTH_DRIVER defaults to 'supabase', so Render
// and local development are unaffected and switching back is an env change
// rather than a deploy.
import { env } from '../../config/env';
import { supabaseAuthProvider } from './supabaseProvider';
import { cognitoAuthProvider } from './cognitoProvider';
import type { AuthProvider } from './types';

export const authProvider: AuthProvider =
  env.AUTH_DRIVER === 'cognito' ? cognitoAuthProvider : supabaseAuthProvider;

export { InvalidCredentialsError } from './types';
export type { AuthProvider, AuthSession } from './types';
