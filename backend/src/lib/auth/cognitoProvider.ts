// Amazon Cognito implementation.
//
// Two decisions shape everything here.
//
// 1. portal_users.id stays the identity. Cognito mints its own `sub`, but that
//    id is the foreign key used by all 48 tables, so letting `sub` become the
//    identity would mean rewriting every reference. Instead the original UUID
//    rides along in the `custom:portal_id` attribute and is read back out of
//    the token. Nothing downstream can tell the difference.
//
// 2. The ID token is the bearer token, not the access token. Cognito access
//    tokens carry no custom attributes and no email, so they cannot answer
//    "which portal user is this". The ID token carries both, it is signed by
//    the same user pool, and this backend is its only audience - which is
//    exactly the condition under which using an ID token for authorization is
//    sound.
//
// Users are addressed by email. The pool uses UsernameAttributes: [email], so
// the Admin* APIs accept an email wherever they take a Username, which saves
// keeping a second identifier in sync.
import { randomUUID } from 'crypto';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminUserGlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { env } from '../../config/env';
import { supabaseAdmin } from '../../config/supabase';
import { InvalidCredentialsError, type AuthProvider, type AuthSession } from './types';

const PORTAL_ID_ATTR = 'custom:portal_id';

function requireConfig(): { userPoolId: string; clientId: string } {
  const userPoolId = env.COGNITO_USER_POOL_ID;
  const clientId = env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error('AUTH_DRIVER=cognito requires COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
  }
  return { userPoolId, clientId };
}

let client: CognitoIdentityProviderClient | null = null;
function idp(): CognitoIdentityProviderClient {
  if (!client) client = new CognitoIdentityProviderClient({ region: env.AWS_REGION ?? 'us-east-1' });
  return client;
}

// The verifier caches the pool's JWKS, so tokens are validated locally after
// the first fetch - no network round trip per request.
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
function jwt() {
  if (!verifier) {
    const { userPoolId, clientId } = requireConfig();
    verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
  }
  return verifier;
}

/**
 * Cognito is addressed by email; the rest of the app speaks portal_users.id.
 * Resolve one to the other. Reads the CURRENT address, so an email change must
 * call this before writing the new value to portal_users.
 */
async function emailFor(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('portal_users').select('email').eq('id', userId).maybeSingle();
  if (!data?.email) throw new Error(`No portal_users row for ${userId}; cannot address Cognito user`);
  return String(data.email).trim().toLowerCase();
}

function sessionFrom(
  r: { AccessToken?: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number },
  fallbackRefresh?: string,
): AuthSession {
  if (!r.IdToken) throw new InvalidCredentialsError('Cognito returned no ID token');
  return {
    token: r.IdToken,
    // REFRESH_TOKEN_AUTH does not reissue a refresh token, so carry the
    // existing one forward rather than handing the client an empty string.
    refreshToken: r.RefreshToken ?? fallbackRefresh ?? '',
    expiresAt: Math.floor(Date.now() / 1000) + (r.ExpiresIn ?? 3600),
  };
}

export const cognitoAuthProvider: AuthProvider = {
  name: 'cognito',

  async signIn(email, password) {
    const { userPoolId, clientId } = requireConfig();
    let res;
    try {
      res = await idp().send(new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        // Admin flow: the call itself is authorised by this Lambda's IAM role,
        // so the client needs no secret and the password never leaves the VPC.
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }));
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
        throw new InvalidCredentialsError();
      }
      throw err;
    }

    if (res.ChallengeName) {
      // The app has no UI for MFA or a forced Cognito password change. Admin
      // resets deliberately set passwords as permanent so this cannot happen;
      // surface it loudly rather than returning a half-session.
      throw new Error(`Unsupported Cognito challenge: ${res.ChallengeName}`);
    }

    const session = sessionFrom(res.AuthenticationResult ?? {});
    const { userId } = await this.verifyToken(session.token);
    return { ...session, userId };
  },

  async verifyToken(token) {
    let payload;
    try {
      payload = await jwt().verify(token);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired token');
    }
    const portalId = payload[PORTAL_ID_ATTR];
    if (typeof portalId !== 'string' || !portalId) {
      // A token without the attribute means the user was created outside the
      // migration path. Failing is correct: guessing the portal user from the
      // email would let a mismatched account inherit someone's data.
      throw new InvalidCredentialsError(`Token is missing ${PORTAL_ID_ATTR}`);
    }
    return { userId: portalId };
  },

  async refresh(refreshToken) {
    const { userPoolId, clientId } = requireConfig();
    try {
      const res = await idp().send(new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }));
      return sessionFrom(res.AuthenticationResult ?? {}, refreshToken);
    } catch {
      throw new InvalidCredentialsError('Session expired or invalid');
    }
  },

  async signOut(userId) {
    const { userPoolId } = requireConfig();
    try {
      await idp().send(new AdminUserGlobalSignOutCommand({
        UserPoolId: userPoolId,
        Username: await emailFor(userId),
      }));
    } catch (err) {
      // Logout must never fail the request: the client has already discarded
      // its token, and a user who cannot log out is worse than a stale one.
      console.error('[auth] global sign-out failed for', userId, (err as Error).message);
    }
  },

  async createUser({ email, password }) {
    const { userPoolId } = requireConfig();
    // Generated here, not by Cognito, so the caller can use it as
    // portal_users.id and the two stay linked from the first moment.
    const portalId = randomUUID();

    await idp().send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      // The app sends its own credentials email; Cognito's would duplicate it
      // and quote a password we immediately replace below.
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: PORTAL_ID_ATTR, Value: portalId },
      ],
    }));

    // Permanent, so Cognito does not put the account into
    // FORCE_CHANGE_PASSWORD and answer the next login with a
    // NEW_PASSWORD_REQUIRED challenge. Whether a password is temporary is
    // tracked by portal_users.must_reset_password, which the app already
    // enforces in the authenticate middleware.
    await idp().send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId, Username: email, Password: password, Permanent: true,
    }));

    return { userId: portalId };
  },

  async setPassword(userId, password) {
    const { userPoolId } = requireConfig();
    await idp().send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: await emailFor(userId),
      Password: password,
      Permanent: true,
    }));
  },

  async setEmail(userId, email) {
    const { userPoolId } = requireConfig();
    const current = await emailFor(userId);
    if (current === email.trim().toLowerCase()) return;
    await idp().send(new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: current,
      UserAttributes: [
        { Name: 'email', Value: email },
        // Without this the user lands in an unverified state and cannot sign
        // in with the new address.
        { Name: 'email_verified', Value: 'true' },
      ],
    }));
  },

  async deleteUser(userId) {
    const { userPoolId } = requireConfig();
    let email: string;
    try {
      email = await emailFor(userId);
    } catch {
      // portal_users row already gone: nothing left to address Cognito by.
      return;
    }
    try {
      await idp().send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }));
    } catch (err) {
      if ((err as Error).name !== 'UserNotFoundException') throw err;
    }
  },
};
