import { supabaseAdmin } from '../config/supabase';
import {
  buildPermissionIndex, wouldOrphanAdmin, FALLBACK_GRANTS,
  UNREVOKABLE_PERMISSION, type PermissionRow,
} from '../lib/permissions';
import { ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';

/**
 * Reading and writing the permission tables.
 *
 * The read path runs on EVERY guarded request, so it is cached — but only for
 * a few seconds. `req.user` is already rebuilt from the database on every
 * request (middleware/auth.ts), and a permission change taking effect on the
 * next call rather than the next login is the behaviour people expect from a
 * screen with checkboxes on it. A short TTL keeps both.
 */

const CACHE_TTL_MS = 10_000;

let cache: { at: number; rows: PermissionRow[] } | null = null;
let inFlight: Promise<PermissionRow[]> | null = null;

async function loadRows(): Promise<PermissionRow[]> {
  const { data, error } = await supabaseAdmin
    .from('role_permissions')
    .select('role_key, permission_key, granted');

  // A database problem must not become an outage and must not become a
  // free-for-all. Returning [] here hands every key to the compiled-in
  // fallback, which is what the routes enforce today — so the failure mode of
  // "the permissions table is unreachable" is "the system behaves as it did
  // before anyone could edit permissions".
  if (error) {
    console.error('[permissions.service] could not read role_permissions; falling back to code', error);
    return [];
  }
  return (data ?? []) as PermissionRow[];
}

/** Current rows, cached briefly. Concurrent callers share one query. */
export async function getRows(force = false): Promise<PermissionRow[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  if (!inFlight) {
    inFlight = loadRows().then(rows => {
      cache = { at: Date.now(), rows };
      inFlight = null;
      return rows;
    }).catch(err => {
      inFlight = null;
      throw err;
    });
  }
  return inFlight;
}

/** Drop the cache — called after a write so the next request sees it. */
export function invalidate(): void {
  cache = null;
}

/** May this role use this permission right now? */
export async function may(role: string, key: string): Promise<boolean> {
  const index = buildPermissionIndex(await getRows(), FALLBACK_GRANTS);
  return index(role, key);
}

/** Every permission a role holds — for the /auth/me payload the UI reads. */
export async function permissionsForRole(role: string): Promise<string[]> {
  const rows = await getRows();
  const index = buildPermissionIndex(rows, FALLBACK_GRANTS);
  const keys = new Set([...Object.keys(FALLBACK_GRANTS), ...rows.map(r => r.permission_key)]);
  return [...keys].filter(k => index(role, k)).sort();
}

export async function listForEditor(): Promise<{
  roles: { key: string; label: string; is_builtin: boolean }[];
  permissions: { key: string; label: string; group_name: string; is_custom: boolean }[];
  grants: PermissionRow[];
}> {
  const [roles, permissions, grants] = await Promise.all([
    supabaseAdmin.from('roles').select('key, label, is_builtin').order('key'),
    supabaseAdmin.from('permissions').select('key, label, group_name, is_custom').order('group_name').order('key'),
    getRows(true),
  ]);
  return {
    // The generated Supabase types do not know these tables yet (they are
    // added by migration 052), so the shape is asserted against the return
    // type declared above rather than left as any.
    roles: (roles.data ?? []) as { key: string; label: string; is_builtin: boolean }[],
    permissions: (permissions.data ?? []) as { key: string; label: string; group_name: string; is_custom: boolean }[],
    grants,
  };
}

/**
 * Change one grant.
 *
 * Refuses to remove the last grant of the permission that reaches this
 * screen. Enforced here rather than by hiding a checkbox, because the UI is
 * not the boundary and this system has already had one lockout.
 */
export async function setGrant(
  change: { role_key: string; permission_key: string; granted: boolean },
  actorId?: string,
): Promise<void> {
  const rows = await getRows(true);

  if (wouldOrphanAdmin(rows, change)) {
    throw new ValidationError(
      `'${UNREVOKABLE_PERMISSION}' cannot be removed from the last role that holds it — ` +
      'nobody would be able to change permissions back.',
    );
  }

  const { error } = await supabaseAdmin
    .from('role_permissions')
    .upsert(
      { ...change, updated_at: new Date().toISOString() },
      { onConflict: 'role_key,permission_key' },
    );
  if (error) throw error;

  invalidate();

  const before = rows.find(
    r => r.role_key === change.role_key && r.permission_key === change.permission_key,
  );
  await logActivity(
    actorId ?? null,
    'permission_changed',
    'role_permission',
    `${change.role_key}:${change.permission_key}`,
    `${change.role_key} · ${change.permission_key}`,
    // What it WAS as well as what it became: a permissions audit entry that
    // does not say what changed is of no use when working out who lost access.
    {
      role: change.role_key,
      permission: change.permission_key,
      from: before ? before.granted : '(unset - was using the code default)',
      to: change.granted,
    },
  );
}
