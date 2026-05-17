import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';

const VALID_ROLES = ['admin', 'hr', 'operations', 'finance', 'employee'];

// ── Portal User Management ────────────────────────────────────────────────────

export async function listPortalUsers() {
  const { data, error } = await supabaseAdmin
    .from('portal_users')
    .select('id, email, name, role, employee_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateUserRole(userId: string, role: string, actorId: string) {
  if (!VALID_ROLES.includes(role)) {
    throw new ForbiddenError(`Invalid role: ${role}`);
  }
  // Prevent self-role-change from admin
  if (userId === actorId && role !== 'admin') {
    throw new ForbiddenError('You cannot change your own admin role');
  }

  // Capture the previous role for the audit record before the update.
  const { data: prev } = await supabaseAdmin
    .from('portal_users')
    .select('email, role')
    .eq('id', userId)
    .single();

  const { data, error } = await supabaseAdmin
    .from('portal_users')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('User not found');

  logActivity(actorId, 'updated', 'portal_user', userId, data.email ?? userId.slice(0, 8), {
    event: 'role_changed',
    previousRole: prev?.role,
    newRole: role,
  });
  return data;
}

export async function deactivateUser(userId: string, actorId: string) {
  if (userId === actorId) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  // Look up the target email/role for the audit record before the delete cascades.
  const { data: target } = await supabaseAdmin
    .from('portal_users')
    .select('email, role')
    .eq('id', userId)
    .single();

  // Delete the Supabase Auth user (this also cascades portal_users via FK)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;

  // Also remove portal_users row if not cascade-deleted
  await supabaseAdmin.from('portal_users').delete().eq('id', userId);

  logActivity(actorId, 'deleted', 'portal_user', userId, target?.email ?? userId.slice(0, 8), {
    event: 'deactivated',
    role: target?.role,
  });
}

export async function resetUserPassword(userId: string, actorId?: string): Promise<string> {
  const tempPassword = 'Jobly@' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) throw error;

  // Audit: capture WHO reset WHOSE password, but never log the new password.
  const { data: target } = await supabaseAdmin
    .from('portal_users').select('email').eq('id', userId).single();
  logActivity(actorId ?? null, 'updated', 'portal_user', userId, target?.email ?? userId.slice(0, 8), {
    event: 'password_reset',
  });
  return tempPassword;
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

export interface ActivityLogsQuery {
  entityType?: string;
  action?: string;
  actorId?: string;
  page: number;
  limit: number;
}

export async function listActivityLogs(query: ActivityLogsQuery) {
  let q = supabaseAdmin
    .from('activity_logs')
    .select('*, portal_users!actor_id(email, name, role)', { count: 'exact' });

  if (query.entityType) q = q.eq('entity_type', query.entityType);
  if (query.action)     q = q.eq('action', query.action);
  if (query.actorId)    q = q.eq('actor_id', query.actorId);

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}
