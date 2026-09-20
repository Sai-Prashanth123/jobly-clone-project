// The identity operations the application actually performs, extracted from
// every supabaseAdmin.auth / supabaseAnon.auth call site in src/.
//
// Deliberately small: the app never touches OAuth, magic links, phone auth or
// Supabase's session objects, so none of that needs an equivalent in Cognito.
//
// `userId` is always portal_users.id throughout this interface. That id is the
// foreign key used by all 48 tables, so it has to survive the move to Cognito
// unchanged - the Cognito implementation carries it in a custom attribute
// rather than letting Cognito's own `sub` become the identity.

export interface AuthSession {
  token: string;
  refreshToken: string;
  /** Unix seconds, matching what the frontend already stores. */
  expiresAt: number;
}

export interface AuthProvider {
  /** Name of the backing identity store, for logs and /health. */
  readonly name: 'supabase' | 'cognito';

  signIn(email: string, password: string): Promise<AuthSession & { userId: string }>;

  /** Validate a bearer token and return the portal user id it belongs to. */
  verifyToken(token: string): Promise<{ userId: string }>;

  refresh(refreshToken: string): Promise<AuthSession>;

  /** Best-effort: revoke outstanding sessions for this user. */
  signOut(userId: string): Promise<void>;

  /** Creates the login and returns the id to store as portal_users.id. */
  createUser(input: { email: string; password: string }): Promise<{ userId: string }>;

  /**
   * Set a password directly, without knowing the old one. Used for admin
   * resets and for the self-service change (which verifies the current
   * password separately, by signing in with it).
   */
  setPassword(userId: string, password: string): Promise<void>;

  /** Move the login identity to a new address. */
  setEmail(userId: string, email: string): Promise<void>;

  deleteUser(userId: string): Promise<void>;
}

/** Thrown for a wrong password or unknown account - never leaks which. */
export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}
