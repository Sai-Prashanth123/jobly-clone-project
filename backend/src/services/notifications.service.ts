import { supabaseAdmin } from '../config/supabase';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  entityType?: string,
  entityId?: string,
  link?: string,
) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    link: link ?? null,
  });
  // Best-effort: a failed notification must not break the calling flow, but log
  // it so silent delivery failures are visible in the server logs.
  if (error) console.warn('[notifications.service] createNotification failed:', error.message);
}

// A notification "event" can exist as several per-recipient rows (a role
// fan-out creates one per user). For the admin all-notifications view we collapse
// those copies into one by this content key so admin doesn't see duplicates.
function eventKey(n: { title: string; message: string; entity_type: string | null; entity_id: string | null }): string {
  return [n.title, n.message, n.entity_type ?? '', n.entity_id ?? ''].join('|');
}

// Constrain an admin update to all rows that share a notification's content
// (so marking one copy read marks the whole event read for the admin).
function matchEvent(query: any, n: { title: string; message: string; entity_type: string | null; entity_id: string | null }) {
  let q = query.eq('title', n.title).eq('message', n.message);
  q = n.entity_type === null ? q.is('entity_type', null) : q.eq('entity_type', n.entity_type);
  q = n.entity_id === null ? q.is('entity_id', null) : q.eq('entity_id', n.entity_id);
  return q;
}

export async function listNotifications(userId: string, role?: string) {
  // Admin sees EVERY notification in the system (its own read state via
  // admin_read), with fan-out copies de-duplicated to one per event.
  if (role === 'admin') {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    const seen = new Set<string>();
    const out: any[] = [];
    for (const n of data ?? []) {
      const key = eventKey(n);
      if (seen.has(key)) continue;
      seen.add(key);
      // Present the admin's own read flag as `read` so the UI works unchanged.
      out.push({ ...n, read: !!n.admin_read });
    }
    // Unread first, then most recent.
    out.sort((a, b) => (a.read === b.read ? (a.created_at < b.created_at ? 1 : -1) : (a.read ? 1 : -1)));
    return out.slice(0, 50);
  }

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

export async function markRead(notificationId: string, userId: string, role?: string) {
  if (role === 'admin') {
    const { data: n } = await supabaseAdmin
      .from('notifications').select('title, message, entity_type, entity_id').eq('id', notificationId).maybeSingle();
    if (!n) return;
    const { error } = await matchEvent(supabaseAdmin.from('notifications').update({ admin_read: true }), n);
    if (error) throw error;
    return;
  }
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markAllRead(userId: string, role?: string) {
  if (role === 'admin') {
    const { error } = await supabaseAdmin
      .from('notifications').update({ admin_read: true }).eq('admin_read', false);
    if (error) throw error;
    return;
  }
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function getUnreadCount(userId: string, role?: string) {
  if (role === 'admin') {
    // Count DISTINCT unread events (collapse fan-out copies). Mirror the exact
    // fetch shape that listNotifications uses (recent rows, then filter in JS) so
    // the badge always matches the list.
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('title, message, entity_type, entity_id, admin_read')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    const seen = new Set<string>();
    for (const n of data ?? []) {
      if (!n.admin_read) seen.add(eventKey(n));
    }
    return seen.size;
  }
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

/** Find the portal_user id for the reporting manager of the given employee. */
export async function getReportingManagerPortalUserId(employeeId: string): Promise<string | null> {
  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('reporting_manager_id')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp?.reporting_manager_id) return null;
  return getPortalUserByEmployeeId(emp.reporting_manager_id);
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
      'warning', 'timesheet', assignment.id, '/portal/timesheets',
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
        'client', client.id, `/portal/clients/${client.id}`,
      );
    }
    sent += recipients.length;
  }

  return { sent };
}

/**
 * Invoice readiness reminder — call when finance users need to be nudged
 * about timesheets that are fully approved but not yet invoiced.
 * Groups pending timesheets by client for a single summary notification per client
 * per finance user.
 */
export async function triggerInvoiceReadinessReminders(): Promise<{ sent: number }> {
  // Fetch all fully-approved timesheets
  const { data: approved } = await supabaseAdmin
    .from('timesheets')
    .select('id, display_id, client_id, total_hours, week_start_date, week_end_date')
    .eq('status', 'manager_approved');

  const approvedList = approved ?? [];
  if (approvedList.length === 0) return { sent: 0 };

  // Filter out any already linked to an invoice via the junction table
  const approvedIds = approvedList.map(t => t.id);
  const { data: linked } = await supabaseAdmin
    .from('invoice_timesheets')
    .select('timesheet_id')
    .in('timesheet_id', approvedIds);
  const linkedSet = new Set((linked ?? []).map(r => r.timesheet_id));

  const pending = approvedList.filter(t => !linkedSet.has(t.id));
  if (pending.length === 0) return { sent: 0 };

  // Group by client
  const byClient = new Map<string, typeof pending>();
  for (const t of pending) {
    const arr = byClient.get(t.client_id) ?? [];
    arr.push(t);
    byClient.set(t.client_id, arr);
  }

  // Fetch client names
  const clientIds = [...byClient.keys()];
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, company_name')
    .in('id', clientIds);
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  const financeIds = await getUserIdsByRole('finance');
  if (financeIds.length === 0) return { sent: 0 };

  let sent = 0;
  for (const [clientId, list] of byClient.entries()) {
    const clientName = clientMap.get(clientId) ?? 'a client';
    const totalHours = list.reduce((s, t) => s + Number(t.total_hours ?? 0), 0);
    const msg = `${list.length} approved timesheet${list.length === 1 ? '' : 's'} (${totalHours.toFixed(1)}h) for ${clientName} are ready to invoice.`;
    for (const uid of financeIds) {
      await createNotification(
        uid,
        'Invoices Ready to Generate',
        msg,
        'info',
        'client',
        clientId,
        `/portal/clients/${clientId}`,
      );
      sent++;
    }
  }

  return { sent };
}

/**
 * Document expiry alerts — notifies employees whose visa, passport, OPT card,
 * EAD, or I-983 expires within 90 days, plus HR/admin for their records.
 */
export async function triggerDocumentExpiryAlerts(): Promise<{ sent: number }> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 90));
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, first_name, last_name, visa_expiry, identity_documents')
    .is('deleted_at', null)
    .neq('status', 'terminated');

  if (!employees || employees.length === 0) return { sent: 0 };

  const adminIds = await getUserIdsByRole('admin');
  const hrIds = await getUserIdsByRole('hr');
  const hrAdminRecipients = [...new Set([...adminIds, ...hrIds])];

  let sent = 0;

  for (const emp of employees) {
    const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
    const expiringDocs: { type: string; expiry: string; daysLeft: number }[] = [];

    if (emp.visa_expiry && emp.visa_expiry >= todayStr && emp.visa_expiry <= cutoffStr) {
      const daysLeft = Math.ceil((new Date(emp.visa_expiry + 'T00:00:00Z').getTime() - new Date(todayStr + 'T00:00:00Z').getTime()) / 86400000);
      expiringDocs.push({ type: 'Visa / Work Authorization', expiry: emp.visa_expiry, daysLeft });
    }

    const docs = (emp.identity_documents ?? []) as Array<{ type?: string; label?: string; expiry?: string }>;
    for (const doc of docs) {
      if (!doc.expiry || doc.expiry < todayStr || doc.expiry > cutoffStr) continue;
      const daysLeft = Math.ceil((new Date(doc.expiry + 'T00:00:00Z').getTime() - new Date(todayStr + 'T00:00:00Z').getTime()) / 86400000);
      expiringDocs.push({ type: doc.label ?? doc.type ?? 'Document', expiry: doc.expiry, daysLeft });
    }

    if (expiringDocs.length === 0) continue;

    for (const doc of expiringDocs) {
      const urgency: 'error' | 'warning' | 'info' = doc.daysLeft <= 14 ? 'error' : doc.daysLeft <= 30 ? 'warning' : 'info';
      const hrMsg = `${fullName} (${emp.display_id}): ${doc.type} expires in ${doc.daysLeft} day${doc.daysLeft === 1 ? '' : 's'} on ${doc.expiry}.`;
      for (const uid of hrAdminRecipients) {
        await createNotification(uid, 'Document Expiring Soon', hrMsg, urgency, 'employee', emp.id, `/portal/employees/${emp.id}`);
        sent++;
      }
      const empPortalUserId = await getPortalUserByEmployeeId(emp.id);
      if (empPortalUserId) {
        await createNotification(empPortalUserId, 'Your Document Is Expiring', `Your ${doc.type} expires in ${doc.daysLeft} day${doc.daysLeft === 1 ? '' : 's'} on ${doc.expiry}. Please renew it and upload the updated copy.`, urgency, 'employee', emp.id, '/portal/profile');
        sent++;
      }
    }
  }

  return { sent };
}
