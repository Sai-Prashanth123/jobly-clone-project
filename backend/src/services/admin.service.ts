import { supabaseAdmin } from '../config/supabase';
import { authProvider } from '../lib/auth';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sendWelcomeEmail, mailerConfigured } from '../lib/mailer';
import { generateTempPassword } from '../lib/tempPassword';

const VALID_ROLES = ['admin', 'hr', 'operations', 'finance', 'employee', 'legal'];

// ── Portal User Management ────────────────────────────────────────────────────

export async function listPortalUsers() {
  const { data, error } = await supabaseAdmin
    .from('portal_users')
    .select('id, email, name, role, employee_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a STAFF portal login (admin / hr / operations / finance / legal).
 *
 * This did not exist. The only way to get a portal login was to create an
 * employee, which always produces role 'employee' and an employee record —
 * wrong for an HR manager or an administrator, who need an account without a
 * timesheet attached. Staff logins were therefore being created by hand, or
 * not at all, which is how the hardcoded "demo accounts" ended up on the
 * sign-in page standing in for real ones.
 *
 * The temp password is first-login-only: must_reset_password forces the user
 * to set their own before they can do anything, so the password this returns
 * stops working the moment they use it.
 */
export async function createStaffUser(
  input: { email: string; name: string; role: string },
  actorId: string,
): Promise<{ id: string; email: string; name: string; role: string; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  const role = input.role.trim().toLowerCase();

  if (!VALID_ROLES.includes(role)) {
    throw new ValidationError(`Invalid role "${input.role}". Expected one of: ${VALID_ROLES.join(', ')}`);
  }
  // 'employee' belongs to the employee-creation flow, which also builds the
  // employee record this path deliberately does not.
  if (role === 'employee') {
    throw new ValidationError('Create employees through Employees → New Employee, not here.');
  }

  const { data: existing } = await supabaseAdmin
    .from('portal_users').select('id').eq('email', email).maybeSingle();
  if (existing) throw new ConflictError('A portal user with this email already exists.', { field: 'email' });

  const tempPassword = generateTempPassword();
  const created = await authProvider.createUser({ email, password: tempPassword });
  if (!created?.userId) throw new Error('Auth provider did not return a user id');

  const parts = input.name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || email[0].toUpperCase();

  const { error: insertErr } = await supabaseAdmin.from('portal_users').insert({
    id: created.userId,
    email,
    name: input.name.trim(),
    role,
    avatar_initials: initials,
    must_reset_password: true,
    temp_password_issued_at: new Date().toISOString(),
  });
  if (insertErr) throw insertErr;

  // Awaited, not fire-and-forget: the Lambda container freezes the moment the
  // response returns, so an unawaited send is abandoned mid-flight.
  if (mailerConfigured) {
    await sendWelcomeEmail({
      to: email,
      firstName: parts[0] || 'there',
      lastName: parts.slice(1).join(' '),
      loginEmail: email,
      tempPassword,
      subject: 'Your Jobly Portal account',
      bodyIntro: 'An account has been created for you on the Jobly Portal. Use the temporary password below to sign in &mdash; you will be asked to set your own password straight away.',
    }).catch(err => console.error('[admin.createStaffUser] welcome email failed for', email, err));
  }

  await logActivity(actorId, 'created', 'portal_user', created.userId, email, { event: 'staff_user_created', role });

  return { id: created.userId, email, name: input.name.trim(), role, tempPassword };
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

  await logActivity(actorId, 'updated', 'portal_user', userId, data.email ?? userId.slice(0, 8), {
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

  // Login first, then the profile row. The provider addresses the account via
  // portal_users.email, so the row has to outlive the delete.
  //
  // The row is no longer removed by a cascade either: portal_users.id used to
  // carry an ON DELETE CASCADE foreign key to auth.users, which the move to
  // RDS dropped. Deleting it explicitly is now the only thing that removes it.
  await authProvider.deleteUser(userId);
  await supabaseAdmin.from('portal_users').delete().eq('id', userId);

  await logActivity(actorId, 'deleted', 'portal_user', userId, target?.email ?? userId.slice(0, 8), {
    event: 'deactivated',
    role: target?.role,
  });
}

export async function resetUserPassword(userId: string, actorId?: string): Promise<string> {
  const tempPassword = generateTempPassword();
  await authProvider.setPassword(userId, tempPassword);

  // The reset is one-time: force a fresh first-login password reset so the temp
  // never becomes the user's standing password.
  await supabaseAdmin.from('portal_users').update({
    must_reset_password: true,
    password_changed_at: null,
    temp_password_issued_at: new Date().toISOString(),
  }).eq('id', userId);

  const { data: target } = await supabaseAdmin
    .from('portal_users').select('email, name').eq('id', userId).single();

  // Email the temp credentials so the admin does not have to relay them by hand.
  // MUST be awaited on Lambda. lambda.ts sets
  // context.callbackWaitsForEmptyEventLoop = false (it has to - the pg pool
  // keeps idle sockets open, so the event loop is never empty), which means
  // the container FREEZES the moment the response is returned. A fire-and-
  // forget promise is suspended mid-flight and never finishes, so the work
  // below silently never happened. That is why "forgot password sends no
  // email" - the log said "sending email" and nothing followed it.
  //
  // The original reasoning (do not block the response on a slow SMTP
  // roundtrip) was sound on a long-running server. On Lambda it just drops
  // the work. SES is an API call of a couple of hundred ms, and every callee
  // here swallows its own errors, so awaiting cannot fail the request.
  if (target?.email && mailerConfigured) {
    const parts = (target.name ?? '').trim().split(/\s+/);
    await sendWelcomeEmail({
      to: target.email,
      firstName: parts[0] || 'there',
      lastName: parts.slice(1).join(' '),
      loginEmail: target.email,
      tempPassword,
      subject: 'Your Jobly Portal password has been reset',
      bodyIntro: 'Your Jobly Portal password has been reset by an administrator. Use the temporary password below to log in &mdash; you will be asked to set a new password right away.',
    }).catch(err => console.error('[admin.resetUserPassword] temp-password email failed for', userId, err));
  }

  // Audit: capture WHO reset WHOSE password, but never log the new password.
  await logActivity(actorId ?? null, 'updated', 'portal_user', userId, target?.email ?? userId.slice(0, 8), {
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
