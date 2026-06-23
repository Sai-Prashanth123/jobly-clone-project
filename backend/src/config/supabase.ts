import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service role client — bypasses RLS, use only on backend.
// Explicitly set Authorization in global.headers so supabase-js 2.100.x
// does not drop it: fetchWithAuth only overrides Authorization when
// !headers.has("Authorization"), so pre-seeding it guarantees the
// service-role key is always present even if _getAccessToken() misbehaves.
export const supabaseAdmin = createClient(
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
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`;
  const res = await fetch(url, { headers: SVC_HEADERS() });
  if (!res.ok) return null;
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPortalUserByEmail(email: string): Promise<any | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`;
  const res = await fetch(url, { headers: SVC_HEADERS() });
  if (!res.ok) return null;
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function patchPortalUser(userId: string, patch: Record<string, unknown>): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/portal_users?id=eq.${encodeURIComponent(userId)}`;
  await fetch(url, {
    method: 'PATCH',
    headers: SVC_HEADERS(),
    body: JSON.stringify(patch),
  });
}
