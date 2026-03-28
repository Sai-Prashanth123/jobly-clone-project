import { supabaseAdmin } from '../config/supabase';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  entityType?: string,
  entityId?: string,
) {
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
  });
}

export async function listNotifications(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function markRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markAllRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count ?? 0;
}

/** Find portal_users by role — used to notify groups (e.g. all finance users) */
export async function getUserIdsByRole(role: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('portal_users')
    .select('id')
    .eq('role', role);
  return (data ?? []).map(u => u.id);
}

/** Find the portal_user id for an employee */
export async function getPortalUserByEmployeeId(employeeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('portal_users')
    .select('id')
    .eq('employee_id', employeeId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Timesheet submission reminder — call weekly (e.g. every Monday).
 * Finds all active assignments that have NO timesheet for the current week
 * and sends a reminder to the employee's portal account.
 */
export async function triggerTimesheetReminders(): Promise<{ sent: number }> {
  // Compute current week Monday — UTC-safe (getUTCDay avoids server-timezone drift)
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
  const weekStart = monday.toISOString().split('T')[0];

  const { data: activeAssignments } = await supabaseAdmin
    .from('assignments')
    .select('id, employee_id, project_name, client_id, display_id')
    .eq('status', 'active');

  const { data: submittedThisWeek } = await supabaseAdmin
    .from('timesheets')
    .select('employee_id, assignment_id')
    .eq('week_start_date', weekStart);

  const submittedSet = new Set(
    (submittedThisWeek ?? []).map(t => `${t.employee_id}:${t.assignment_id}`)
  );

  const missing = (activeAssignments ?? []).filter(
    a => !submittedSet.has(`${a.employee_id}:${a.id}`)
  );

  // Fetch client names
  const clientIds = [...new Set(missing.map(a => a.client_id))];
  const { data: clients } = clientIds.length > 0
    ? await supabaseAdmin.from('clients').select('id, company_name').in('id', clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  let sent = 0;
  for (const assignment of missing) {
    const portalUserId = await getPortalUserByEmployeeId(assignment.employee_id);
    if (!portalUserId) continue;
    const clientName = clientMap.get(assignment.client_id) ?? 'your client';
    await createNotification(
      portalUserId,
      'Timesheet Reminder',
      `You haven't submitted your timesheet for "${assignment.project_name}" at ${clientName} for the week of ${weekStart}. Please submit it as soon as possible.`,
      'warning', 'timesheet', assignment.id,
    );
    sent++;
  }

  return { sent };
}

/**
 * Contract expiry alert — call daily or weekly.
 * Finds clients whose contracts expire within the next 30 days
 * and notifies admin users.
 */
export async function triggerContractExpiryAlerts(): Promise<{ sent: number }> {
  // UTC-safe date range — avoids server-timezone drift on setDate() calls
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data: expiring } = await supabaseAdmin
    .from('clients')
    .select('id, company_name, contract_end_date, display_id')
    .eq('status', 'active')
    .not('contract_end_date', 'is', null)
    .gte('contract_end_date', todayStr)
    .lte('contract_end_date', cutoffStr)
    .order('contract_end_date', { ascending: true });

  if (!expiring || expiring.length === 0) return { sent: 0 };

  const adminIds = await getUserIdsByRole('admin');
  const financeIds = await getUserIdsByRole('finance');
  const recipients = [...new Set([...adminIds, ...financeIds])];

  let sent = 0;
  for (const client of expiring) {
    // Parse both dates as UTC midnight to avoid timezone-offset bias
    const endDate = new Date(client.contract_end_date + 'T00:00:00Z');
    const todayMidnight = new Date(todayStr + 'T00:00:00Z');
    const daysLeft = Math.ceil((endDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    const label = client.display_id ?? client.company_name;
    const urgency = daysLeft <= 7 ? 'error' : daysLeft <= 14 ? 'warning' : 'info';
    for (const uid of recipients) {
      await createNotification(
        uid,
        'Contract Expiring Soon',
        `Client contract for ${client.company_name} (${label}) expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} on ${client.contract_end_date}. Please renew or take action.`,
        urgency as 'info' | 'warning' | 'error' | 'success',
        'client', client.id,
      );
    }
    sent += recipients.length;
  }

  return { sent };
}
