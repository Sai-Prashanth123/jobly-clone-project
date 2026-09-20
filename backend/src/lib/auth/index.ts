// Picks the identity backend. AUTH_DRIVER defaults to 'supabase', so Render
// and local development are unaffected and switching back is an env change
// rather than a deploy.
//
// Resolved on first USE, for the same reason as lib/storage: config/env
// validates and calls process.exit(1) at import time, so an eager import here
// would break any test that mocks config/supabase to avoid needing a full
// environment.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { AuthProvider } from './types';

let impl: AuthProvider | null = null;

function resolve(): AuthProvider {
  if (impl) return impl;
  impl = process.env.AUTH_DRIVER === 'cognito'
    ? (require('./cognitoProvider') as typeof import('./cognitoProvider')).cognitoAuthProvider
    : (require('./supabaseProvider') as typeof import('./supabaseProvider')).supabaseAuthProvider;
  return impl;
}

export const authProvider: AuthProvider = {
  get name() { return resolve().name; },
  signIn: (...a) => resolve().signIn(...a),
  verifyToken: (...a) => resolve().verifyToken(...a),
  refresh: (...a) => resolve().refresh(...a),
  signOut: (...a) => resolve().signOut(...a),
  createUser: (...a) => resolve().createUser(...a),
  setPassword: (...a) => resolve().setPassword(...a),
  setEmail: (...a) => resolve().setEmail(...a),
  deleteUser: (...a) => resolve().deleteUser(...a),
};

/** Test seam: forget the resolved driver. */
export function resetAuthProvider(): void {
  impl = null;
}

export { InvalidCredentialsError } from './types';
export type { AuthProvider, AuthSession } from './types';
