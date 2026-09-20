import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { getPool, isPostgresDriver } from './db';
import { createPgrest } from '../lib/pgrest/builder';

// Service role client — bypasses RLS, use only on backend.
// Explicitly set Authorization in global.headers so supabase-js 2.100.x
// does not drop it: fetchWithAuth only overrides Authorization when
// !headers.has("Authorization"), so pre-seeding it guarantees the
// service-role key is always present even if _getAccessToken() misbehaves.
const supabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

// ---------------------------------------------------------------------------
// Table access: Supabase PostgREST, or direct SQL against RDS.
//
// Only .from() moves. Storage and Auth stay on Supabase in both modes because
// they are separate migration phases (S3 and Cognito) — splitting them lets
// the database move without waiting on either.
//
// The cast is deliberate. The pgrest builder reimplements the PostgREST
// surface these services use (verified by src/lib/pgrest/pgrest.test.ts and by
// executing every real select string against RDS), but it is not structurally
// identical to supabase-js's generated PostgrestFilterBuilder types. Typing it
// honestly would mean editing all 496 call sites, which is exactly the churn
// this shim exists to avoid.
// ---------------------------------------------------------------------------
function buildAdmin(): SupabaseClient {
  if (!isPostgresDriver()) return supabaseClient;

  const pgrest = createPgrest(getPool());
  const hybrid = {
    from: (table: string) => pgrest.from(table),
    storage: supabaseClient.storage,
    auth: supabaseClient.auth,
    rpc: () => {
      // No service calls .rpc() today (verified by grep). Failing loudly beats
      // silently returning an empty result if one is ever added.
      throw new Error('pgrest: .rpc() is not implemented for DB_DRIVER=postgres');
    },
  };
  return hybrid as unknown as SupabaseClient;
}

export const supabaseAdmin = buildAdmin();

// Anon client — for Auth operations only
export const supabaseAnon = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

// Direct REST fetch for portal_users — bypasses supabase-js client so the
// service-role key is always sent explicitly in both required headers.
// supabase-js 2.100.x can silently drop the Authorization header on the
// first request, causing RLS (USING false) to block the query.
const SVC_HEADERS = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPortalUser(userId: string): Promise<any | null> {
  if (isPostgresDriver()) {
    // The header workaround above is a supabase-js bug fix; against RDS there
    // is no PostgREST and no RLS, so the ordinary path is correct here.
    const { data } = await supabaseAdmin.from('portal_users').select('*').eq('id', userId).maybeSingle();
    return data ?? null;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`;
  const res = await fetch(url, { headers: SVC_HEADERS() });
  if (!res.ok) return null;
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPortalUserByEmail(email: string): Promise<any | null> {
  if (isPostgresDriver()) {
    const { data } = await supabaseAdmin.from('portal_users').select('id').eq('email', email).maybeSingle();
    return data ?? null;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`;
  const res = await fetch(url, { headers: SVC_HEADERS() });
  if (!res.ok) return null;
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function patchPortalUser(userId: string, patch: Record<string, unknown>): Promise<void> {
  if (isPostgresDriver()) {
    await supabaseAdmin.from('portal_users').update(patch).eq('id', userId);
    return;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?id=eq.${encodeURIComponent(userId)}`;
  await fetch(url, {
    method: 'PATCH',
    headers: SVC_HEADERS(),
    body: JSON.stringify(patch),
  });
}
