import { supabaseAdmin } from '../config/supabase';
import {
  MAX_ALERT_INTERVAL_DAYS, shouldAlert, docAlertKey, parseDocAlertKey,
  expiryUrgency, describeExpiry, daysBetween,
} from '../lib/expiryAlerts';

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
// `type` is included so two distinct events that happen to share the same
// title/message/entity (e.g. a re-triggered check reusing the same wording)
// can never silently swap the type/link an admin sees displayed for the card.
function eventKey(n: { title: string; message: string; entity_type: string | null; entity_id: string | null; type: string }): string {
  return [n.title, n.message, n.entity_type ?? '', n.entity_id ?? '', n.type].join('|');
}

// Constrain an admin update to all rows that share a notification's content
// (so marking one copy read marks the whole event read for the admin).
// Scoped by `type` too, matching eventKey — otherwise marking one event read
// could incorrectly also mark a different-typed event read purely because it
// happens to share the same title/message/entity.
function matchEvent(query: any, n: { title: string; message: string; entity_type: string | null; entity_id: string | null; type: string }) {
  let q = query.eq('title', n.title).eq('message', n.message).eq('type', n.type);
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
      .from('notifications').select('title, message, entity_type, entity_id, type').eq('id', notificationId).maybeSingle();
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

export interface NotificationCounts {
  total: number;
  unread: number;
  read: number;
  byType: { info: number; success: number; warning: number; error: number };
}

function emptyByType() {
  return { info: 0, success: 0, warning: 0, error: 0 };
}

/**
 * Accurate unread/read/total/by-type counts — deliberately NOT derived from
 * listNotifications()'s capped, display-oriented result set (that list is
 * capped at 50 rows for rendering; using its length for counts meant the
 * unread badge got permanently stuck at 50 once a user crossed that many
 * unread notifications, since marking one read just let another take its
 * place in the capped window).
 */
export async function getNotificationCounts(userId: string, role?: string): Promise<NotificationCounts> {
  if (role === 'admin') {
    // Mirror listNotifications' event de-dup so the counts always match what
    // the admin list actually shows (collapse fan-out copies by event key,
    // keeping the most-recently-inserted row's type/read-state per event).
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('title, message, entity_type, entity_id, type, admin_read')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    const seen = new Map<string, { type: string; read: boolean }>();
    for (const n of data ?? []) {
      const key = eventKey(n);
      if (seen.has(key)) continue;
      seen.set(key, { type: n.type, read: !!n.admin_read });
    }
    const byType = emptyByType();
    let unread = 0;
    for (const { type, read } of seen.values()) {
      if (type in byType) byType[type as keyof typeof byType]++;
      if (!read) unread++;
    }
    return { total: seen.size, unread, read: seen.size - unread, byType };
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('type, read')
    .eq('user_id', userId);
  if (error) throw error;
  const rows = data ?? [];
  const byType = emptyByType();
  let unread = 0;
  for (const n of rows) {
    if (n.type in byType) byType[n.type as keyof typeof byType]++;
    if (!n.read) unread++;
  }
  return { total: rows.length, unread, read: rows.length - unread, byType };
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

  // Only a genuinely submitted-or-later timesheet counts as "handled" — a
  // 'draft' row is created the moment an employee opens the week, well before
  // they actually submit, so counting drafts here wrongly excluded people who
  // hadn't submitted yet (and let the "missing" set drift as others saved
  // drafts between repeated clicks of this button).
  const { data: submittedThisWeek } = await supabaseAdmin
    .from('timesheets')
    .select('employee_id, assignment_id')
    .eq('week_start_date', weekStart)
    .neq('status', 'draft');

  const submittedSet = new Set(
    (submittedThisWeek ?? []).map(t => `${t.employee_id}:${t.assignment_id}`)
  );

  const missing = (activeAssignments ?? []).filter(
    a => !submittedSet.has(`${a.employee_id}:${a.id}`)
  );

  // Idempotency guard — without this, clicking the button twice re-notified
  // the exact same people with brand-new duplicate rows every time.
  const missingIds = missing.map(a => a.id);
  const { data: alreadyReminded } = missingIds.length > 0
    ? await supabaseAdmin
        .from('notifications')
        .select('entity_id')
        .eq('title', 'Timesheet Reminder')
        .eq('entity_type', 'timesheet')
        .in('entity_id', missingIds)
        .gte('created_at', `${weekStart}T00:00:00.000Z`)
    : { data: [] };
  const remindedSet = new Set((alreadyReminded ?? []).map(r => r.entity_id));
  const toRemind = missing.filter(a => !remindedSet.has(a.id));

  // Fetch client names
  const clientIds = [...new Set(toRemind.map(a => a.client_id))];
  const { data: clients } = clientIds.length > 0
    ? await supabaseAdmin.from('clients').select('id, company_name').in('id', clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));

  let sent = 0;
  for (const assignment of toRemind) {
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

/** Titles this job writes. Used to find its own previous alerts. */
const EXPIRY_ALERT_TITLES = [
  'Document Expiring Soon',
  'Document Expired',
  'Your Document Is Expiring',
  'Your Document Has Expired',
];

/**
 * Document expiry alerts — notifies admin and HR, plus the employee, about a
 * visa, passport, EAD, I-20, I-94, OPT/STEM card, I-983, green card or photo
 * ID that is expiring or has already lapsed.
 *
 * Two deliberate properties, both added after Gayathri asked what this rule
 * actually does:
 *
 *  - **Lapsed documents are included.** The filter used to be
 *    `expiry >= today`, so the day a document expired it dropped out of this
 *    job and off the Expiring Documents page. An expired EAD means somebody is
 *    working without authorisation — the most urgent case was the one case
 *    nothing reported.
 *  - **Alerts repeat on a cadence rather than nightly.** See lib/expiryAlerts.
 */
export async function triggerDocumentExpiryAlerts(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const today = new Date(todayStr + 'T00:00:00Z');
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 90));
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, display_id, first_name, last_name, visa_expiry, identity_documents')
    .is('deleted_at', null)
    .neq('status', 'terminated');

  if (!employees || employees.length === 0) return { sent: 0, skipped: 0 };

  const adminIds = await getUserIdsByRole('admin');
  const hrIds = await getUserIdsByRole('hr');
  const hrAdminRecipients = [...new Set([...adminIds, ...hrIds])];

  // Every alert this job has written in the last month, so the cadence can be
  // judged without a query per document. One read instead of N.
  //
  // The window is the longest interval in alertIntervalDays(); anything older
  // than that is due again regardless, so there is no point fetching it.
  const lookback = new Date(today.getTime() - MAX_ALERT_INTERVAL_DAYS * 86_400_000);
  const { data: priorAlerts } = await supabaseAdmin
    .from('notifications')
    .select('entity_id, message, created_at')
    .eq('entity_type', 'employee')
    .in('title', EXPIRY_ALERT_TITLES)
    .gte('created_at', lookback.toISOString());

  // entityId + document key → when we last said anything about that document.
  //
  // Keyed per document rather than per recipient, so all recipients are told
  // on the same cadence. Someone added to the admin role mid-window waits for
  // the next alert instead of receiving a backlog.
  const lastAlertAt = new Map<string, Date>();
  for (const row of priorAlerts ?? []) {
    // The key is embedded in the message because `notifications` has no
    // metadata column to put it in.
    const docKey = parseDocAlertKey(String(row.message ?? ''));
    if (!docKey) continue;
    const at = new Date(row.created_at as string);
    const key = `${row.entity_id}|${docKey}`;
    const existing = lastAlertAt.get(key);
    if (!existing || at > existing) lastAlertAt.set(key, at);
  }

  let sent = 0;
  let skipped = 0;

  const daysLeftFor = (expiry: string) =>
    Math.ceil((new Date(expiry + 'T00:00:00Z').getTime() - today.getTime()) / 86_400_000);

  for (const emp of employees) {
    const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
    const expiringDocs: { type: string; expiry: string; daysLeft: number }[] = [];

    // No lower bound on either check now — only the 90-day ceiling, so a
    // document that lapsed last year still reports.
    if (emp.visa_expiry && emp.visa_expiry <= cutoffStr) {
      expiringDocs.push({
        type: 'Visa / Work Authorization',
        expiry: emp.visa_expiry,
        daysLeft: daysLeftFor(emp.visa_expiry),
      });
    }

    // Array.isArray, not `?? []` - see listExpiringDocuments. A row holding a
    // JSONB object instead of an array makes `for...of` throw, and this runs
    // inside the daily tick, so one bad record would kill the whole nightly
    // expiry-alert job rather than just skipping that employee.
    const docs = (Array.isArray(emp.identity_documents) ? emp.identity_documents : []) as Array<{ type?: string; label?: string; expiry?: string }>;
    for (const doc of docs) {
      if (!doc.expiry || doc.expiry > cutoffStr) continue;
      // Blank and malformed dates are written by the wizard for untouched
      // fields; `new Date('')` is Invalid Date and would alert on NaN days.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.expiry)) continue;
      expiringDocs.push({
        type: doc.label ?? doc.type ?? 'Document',
        expiry: doc.expiry,
        daysLeft: daysLeftFor(doc.expiry),
      });
    }

    if (expiringDocs.length === 0) continue;

    for (const doc of expiringDocs) {
      const key = `${emp.id}|${docAlertKey(doc.type, doc.expiry)}`;
      const last = lastAlertAt.get(key);
      const daysSinceLast = last ? daysBetween(last, now) : null;
      if (!shouldAlert(doc.daysLeft, daysSinceLast)) {
        skipped++;
        continue;
      }

      const lapsed = doc.daysLeft < 0;
      const urgency = expiryUrgency(doc.daysLeft);
      const phrase = describeExpiry(doc.daysLeft);
      // docAlertKey() has to appear verbatim in the message — it is the only
      // place the next run can read it back from.
      const stable = docAlertKey(doc.type, doc.expiry);

      const hrMsg = `${fullName} (${emp.display_id}): ${stable} — ${phrase}.`;
      for (const uid of hrAdminRecipients) {
        await createNotification(
          uid,
          lapsed ? 'Document Expired' : 'Document Expiring Soon',
          hrMsg,
          urgency,
          'employee',
          emp.id,
          `/portal/employees/${emp.id}`,
        );
        sent++;
      }

      const empPortalUserId = await getPortalUserByEmployeeId(emp.id);
      if (empPortalUserId) {
        await createNotification(
          empPortalUserId,
          lapsed ? 'Your Document Has Expired' : 'Your Document Is Expiring',
          `Your ${stable} — ${phrase}. Please renew it and upload the updated copy.`,
          urgency,
          'employee',
          emp.id,
          '/portal/profile',
        );
        sent++;
      }
    }
  }

  return { sent, skipped };
}

// ── Shared fan-out helpers ────────────────────────────────────────────────────
//
// Every service that notified anyone had grown its own copy of "look up the
// user ids for these roles, dedupe, create one notification each, swallow
// errors". These are that pattern, once, so the areas that had no
// notifications at all can be filled in without each reinventing it — and so
// the audience rule (tell the people it affects) is expressed in one place.
//
// Both swallow their own errors, like createNotification: a notification is
// never important enough to fail the action that triggered it. Callers MUST
// still await them — on Lambda an unawaited promise is frozen when the
// response returns and never runs (see admin.service.resetUserPassword).

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface NotifyPayload {
  title: string;
  message: string;
  type?: NotificationType;
  /** Entity the notification points at, e.g. 'case', 'client', 'invoice'. */
  entityType?: string;
  entityId?: string;
  /** In-portal link. Must be a route the recipient's role can actually open. */
  link?: string;
  /** Usually the actor — nobody needs telling about their own action. */
  excludeUserId?: string | null;
}

/** Notify every user holding any of these roles, once each. */
export async function notifyRoles(roles: string[], n: NotifyPayload): Promise<void> {
  try {
    const idLists = await Promise.all(roles.map(r => getUserIdsByRole(r)));
    const recipients = [...new Set(idLists.flat())].filter(id => id !== n.excludeUserId);
    await Promise.all(recipients.map(uid =>
      createNotification(uid, n.title, n.message, n.type ?? 'info', n.entityType, n.entityId, n.link),
    ));
  } catch (err) {
    console.error('[notifications.service] notifyRoles failed for', roles.join('/'), err);
  }
}

/**
 * Notify the portal user attached to an employee record.
 *
 * Silently does nothing when the employee has no login yet — candidates added
 * through the quick-add flow deliberately have none, and that is not an error.
 */
export async function notifyEmployeeById(employeeId: string, n: NotifyPayload): Promise<void> {
  try {
    const { data: pu } = await supabaseAdmin
      .from('portal_users').select('id').eq('employee_id', employeeId).maybeSingle();
    if (!pu?.id || pu.id === n.excludeUserId) return;
    await createNotification(pu.id, n.title, n.message, n.type ?? 'info', n.entityType, n.entityId, n.link);
  } catch (err) {
    console.error('[notifications.service] notifyEmployeeById failed for', employeeId, err);
  }
}
