// Cognito USER_MIGRATION trigger.
//
// Cognito cannot import password hashes - there is no API for it - so the
// alternatives were to make all 23 users reset their password, or to migrate
// each account silently on its owner's next login. Resetting was not really an
// option: the reset flow emails a temporary password, and outbound mail is not
// configured yet, so it would have locked everyone out.
//
// So: when someone signs in with an account Cognito has never seen, Cognito
// calls this function with the password they typed. It checks that password
// against Supabase Auth, and on success hands Cognito the attributes to create
// the user with. Cognito then stores the password itself. The user notices
// nothing, and every later login is pure Cognito.
//
// The pool drains naturally - each login migrates one account - and the
// Supabase dependency disappears once the last person has signed in.
//
// Runs OUTSIDE the VPC on purpose: its only dependency is Supabase's public
// HTTPS API, and keeping it out means it does not consume an ENI or need the
// NAT gateway.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/** Verify email+password against Supabase Auth. Returns the user id or null. */
async function verifyWithSupabase(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) return null;
  const body = await res.json();
  // The user id here is the same value as portal_users.id, which is what every
  // other table references - so carrying it across is what keeps the migrated
  // account attached to its existing data.
  return body?.user?.id ?? null;
}

exports.handler = async event => {
  const { triggerSource, userName } = event;
  const email = String(userName || '').trim().toLowerCase();

  if (triggerSource === 'UserMigration_Authentication') {
    const portalId = await verifyWithSupabase(email, event.request.password);
    if (!portalId) {
      // Throwing makes Cognito return NotAuthorizedException, i.e. exactly the
      // same answer as a wrong password on an account that already exists.
      // Returning a response without attributes would instead create a broken
      // Cognito user.
      throw new Error('Bad credentials');
    }

    event.response.userAttributes = {
      email,
      email_verified: 'true',
      'custom:portal_id': portalId,
    };
    // CONFIRMED, not RESET_REQUIRED: the password they just typed is their
    // real one, so there is nothing to reset. RESET_REQUIRED would force a
    // Cognito password change the app has no screen for.
    event.response.finalUserStatus = 'CONFIRMED';
    // The app sends its own email; Cognito's would be a surprise.
    event.response.messageAction = 'SUPPRESS';
    return event;
  }

  if (triggerSource === 'UserMigration_ForgotPassword') {
    // The app does not use Cognito's forgot-password flow - resets go through
    // the admin path, which sets a password directly. Refuse rather than
    // create an account with no verified password behind it.
    throw new Error('Forgot-password migration is not supported');
  }

  throw new Error(`Unsupported trigger source: ${triggerSource}`);
};
