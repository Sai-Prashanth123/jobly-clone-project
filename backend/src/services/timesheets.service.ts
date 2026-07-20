import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';
import { isWeekBeforeJoiningUTC } from '../lib/dateUtils';
import { detectLeaveConflictsForDays, approvedLeaveBlockMessage } from './conflicts.service';
import { createNotification, getUserIdsByRole, getPortalUserByEmployeeId, getReportingManagerPortalUserId } from './notifications.service';
import { logActivity } from '../lib/activityLogger';
import { bustNavBadgeCache } from './navBadges.service';
import { listHolidays } from './holidays.service';
import type {
  CreateTimesheetInput, UpdateTimesheetInput,
  PatchTimesheetStatusInput, ListTimesheetsQuery,
} from '../schemas/timesheet.schema';

const TS_SELECT = '*, timesheet_entries(*), employees!employee_id(first_name, last_name, work_email)';

export async function listTimesheets(query: ListTimesheetsQuery, userRole?: string, userId?: string) {
  let q = supabaseAdmin.from('timesheets').select(TS_SELECT, { count: 'exact' });

  if (userRole === 'employee' && userId) {
    const { data: portalUser } = await supabaseAdmin
      .from('portal_users')
      .select('employee_id')
      .eq('id', userId)
      .single();
    if (portalUser?.employee_id) {
      q = q.eq('employee_id', portalUser.employee_id);
    }
  }

  if (query.status) q = q.eq('status', query.status);
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.clientId) q = q.eq('client_id', query.clientId);
  if (query.weekStartDate) q = q.eq('week_start_date', query.weekStartDate);

  // Exclude timesheets already on an invoice — used by the Generate-Invoice
  // picker. Pre-fetch the invoiced IDs (cap to a reasonable batch) and chain
  // a NOT-IN filter. Empty list is a no-op so the main query still runs.
  if (query.excludeInvoiced) {
    const { data: invoicedRows } = await supabaseAdmin
      .from('invoice_timesheets')
      .select('timesheet_id');
    const invoicedIds = (invoicedRows ?? []).map(r => r.timesheet_id).filter(Boolean);
    if (invoicedIds.length > 0) {
      q = q.not('id', 'in', `(${invoicedIds.join(',')})`);
    }
  }

  const offset = (query.page - 1) * query.limit;
  q = q.order('week_start_date', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getTimesheet(id: string, actorRole?: string, actorEmployeeId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .select(TS_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Timesheet not found');
  if (actorRole === 'employee' && data.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only view your own timesheet.');
  }
  return data;
}

// Per-day hours already logged on WEEKLY timesheets overlapping a calendar
// month — used to auto-fill a brand-new monthly "attendance" timesheet
// instead of a generic default, since weekly and monthly timesheets are
// otherwise fully independent systems. Mirrors the overlap-query pattern in
// conflicts.service.ts's getWorkedDays, but returns actual hours (not just a
// worked/not-worked ref) and includes every status (draft included) rather
// than committed-only, since the goal here is "show what's already logged,"
// not conflict detection.
export async function getWeeklyHoursForMonth(employeeId: string, year: number, month: number): Promise<{ date: string; hours: number }[]> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: ts } = await supabaseAdmin
    .from('timesheets')
    .select('id, timesheet_entries(entry_date, hours)')
    .eq('employee_id', employeeId)
    .lte('week_start_date', monthEnd)
    .gte('week_end_date', monthStart);

  const hoursByDate = new Map<string, number>();
  for (const t of ts ?? []) {
    for (const e of ((t as any).timesheet_entries ?? [])) {
      const hours = Number(e.hours) || 0;
      if (hours <= 0 || e.entry_date < monthStart || e.entry_date > monthEnd) continue;
      hoursByDate.set(e.entry_date, (hoursByDate.get(e.entry_date) ?? 0) + hours);
    }
  }
  return [...hoursByDate.entries()].map(([date, hours]) => ({ date, hours }));
}

export async function patchHrNotes(id: string, hrNotes: string | null, actorRole: string) {
  if (actorRole !== 'admin' && actorRole !== 'hr') {
    throw new ForbiddenError('Only admin or HR can update notes.');
  }
  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .update({ hr_notes: hrNotes ?? null })
    .eq('id', id).select(TS_SELECT).single();
  if (error || !data) throw new NotFoundError('Timesheet not found');
  return data;
}

// Independently re-verify holiday status server-side rather than trusting
// whatever the client submitted — mirrors the same protection added for
// monthly timesheets. Weekly entries have no status enum (just hours), so a
// holiday date's hours/billable simply get forced to 0 regardless of what
// was submitted.
async function applyWeeklyHolidayOverrides<T extends { entryDate: string; hours: number; isBillable: boolean }>(entries: T[]): Promise<T[]> {
  if (entries.length === 0) return entries;
  // A week can span two calendar years (e.g. Dec 29 - Jan 4).
  const years = [...new Set(entries.map(e => Number(e.entryDate.slice(0, 4))))];
  const holidaySets = await Promise.all(years.map(y => listHolidays(y)));
  const holidayDates = new Set(holidaySets.flat().map(h => h.date));
  return entries.map(e => holidayDates.has(e.entryDate) ? { ...e, hours: 0, isBillable: false } : e);
}

export async function createTimesheet(input: CreateTimesheetInput, actorRole?: string) {
  // Timesheets are active from the joining date onward — including FUTURE weeks
  // (plan ahead) and elapsed weeks after joining (catch up). The only floor is
  // the date of joining; admin is unrestricted.
  // Date-of-joining floor — can't log a week that ends before the hire date.
  if (actorRole !== 'admin') {
    const { data: empJoin } = await supabaseAdmin
      .from('employees').select('start_date').eq('id', input.employeeId).maybeSingle();
    if (isWeekBeforeJoiningUTC(input.weekStartDate, empJoin?.start_date)) {
      throw new ValidationError(`Timesheets can't start before the joining date (${empJoin?.start_date}).`);
    }
  }

  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('timesheets')
    .select('id')
    .eq('employee_id', input.employeeId)
    .eq('assignment_id', input.assignmentId)
    .eq('week_start_date', input.weekStartDate)
    .maybeSingle();

  if (existing) throw new ConflictError('A timesheet for this employee and week already exists. Open it from the Timesheets list to edit instead of creating a new one.');

  const correctedEntries = await applyWeeklyHolidayOverrides(input.entries);

  // total_hours is computed server-side; ignore any client-supplied value.
  const totalHours = correctedEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  const { data: ts, error: tsError } = await supabaseAdmin
    .from('timesheets')
    .insert({
      employee_id: input.employeeId,
      assignment_id: input.assignmentId,
      client_id: input.clientId,
      week_start_date: input.weekStartDate,
      week_end_date: input.weekEndDate,
      total_hours: totalHours,
      notes: input.notes ?? null,
      leave_reason: input.leaveReason ?? null,
      status: 'draft',
    })
    .select()
    .single();

  if (tsError) {
    // The pre-check above has a race window; the DB-level partial unique
    // index (migration 004) is the real guard. Translate the unique violation
    // into a friendly conflict instead of a generic 500.
    if ((tsError as any).code === '23505') {
      throw new ConflictError('A timesheet for this employee and week already exists. Open it from the Timesheets list to edit instead of creating a new one.');
    }
    throw tsError;
  }

  if (correctedEntries.length > 0) {
    const entries = correctedEntries.map(e => ({
      timesheet_id: ts.id,
      entry_date: e.entryDate,
      day_of_week: e.dayOfWeek,
      hours: e.hours,
      is_billable: e.isBillable,
    }));

    const { error: entryError } = await supabaseAdmin
      .from('timesheet_entries')
      .insert(entries);

    if (entryError) throw entryError;
  }

  return getTimesheet(ts.id);
}

export async function updateTimesheet(id: string, input: UpdateTimesheetInput, userRole?: string, actorEmployeeId?: string | null) {
  const ts = await getTimesheet(id);

  if (userRole === 'employee' && ts.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only edit your own timesheet.');
  }

  // Admin gets god-mode (can edit any status). Everyone else is bound by the
  // status machine — once a timesheet is submitted/approved, only admin can
  // silently rewrite hours. This trades audit safety for operational
  // flexibility; document it clearly to any auditor.
  if (userRole !== 'admin' && !['draft', 'rejected'].includes(ts.status)) {
    throw new ForbiddenError('Can only edit draft or rejected timesheets');
  }

  const correctedEntries = await applyWeeklyHolidayOverrides(input.entries);
  const totalHours = correctedEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  // Upsert entries — avoids duplicate-key errors from concurrent requests
  if (correctedEntries.length > 0) {
    const entries = correctedEntries.map(e => ({
      timesheet_id: id,
      entry_date: e.entryDate,
      day_of_week: e.dayOfWeek,
      hours: e.hours,
      is_billable: e.isBillable,
    }));
    const { error } = await supabaseAdmin
      .from('timesheet_entries')
      .upsert(entries, { onConflict: 'timesheet_id,entry_date' });
    if (error) throw error;
  }

  const updatePayload: Record<string, unknown> = { total_hours: totalHours };
  if (input.notes !== undefined) updatePayload.notes = input.notes ?? null;
  if (input.leaveReason !== undefined) updatePayload.leave_reason = input.leaveReason ?? null;

  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function patchTimesheetStatus(
  id: string,
  input: PatchTimesheetStatusInput,
  userRole: string,
  actorId?: string,
  actorEmployeeId?: string | null,
) {
  const ts = await getTimesheet(id);

  if (userRole === 'employee' && input.status === 'submitted' && ts.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only submit your own timesheet.');
  }

  // State machine: enforce valid transitions regardless of role
  const validTransitions: Record<string, string[]> = {
    draft:            ['submitted'],
    submitted:        ['manager_approved', 'rejected'],
    manager_approved: ['rejected'],
    rejected:         ['submitted'],
  };
  if (!validTransitions[ts.status]?.includes(input.status)) {
    throw new ForbiddenError(`Cannot transition from '${ts.status}' to '${input.status}'`);
  }

  // Role-based status transition rules
  const allowed: Record<string, string[]> = {
    submitted:         ['employee', 'admin', 'operations'],
    manager_approved:  ['admin', 'operations', 'hr'],
    rejected:          ['admin', 'operations', 'finance', 'hr'],
  };

  const action = input.status;
  if (!allowed[action]?.includes(userRole)) {
    throw new ForbiddenError(`Role '${userRole}' cannot set status to '${action}'`);
  }

  // Submit-time gates (only checked when transitioning into `submitted`).
  // Timesheets are active from the joining date → future, so there is no
  // past/future week lockout here — only the content gates below:
  //  - Zero-hour weeks require leave_reason.
  //  - Client-signed proof is OPTIONAL (can be attached before or after submit).
  //  - No hours on a day the employee is on approved leave.
  if (action === 'submitted' && userRole !== 'admin') {
    const hours = Number(ts.total_hours ?? 0);
    if (hours === 0 && !ts.leave_reason) {
      throw new ValidationError('Add a reason (e.g. medical leave, sick, unpaid leave) before submitting a zero-hour timesheet.');
    }
  }

  // Leave conflict: you can't bill/approve hours on a day the employee is on
  // APPROVED leave. Checked at submit-time AND at each approval stage, because
  // the leave request may be approved independently *after* the timesheet was
  // already submitted (or while it's sitting in manager_approved awaiting
  // client sign-off) — re-check on every gate so a stale approval can't slip
  // hours through. (Admin is exempt — god-mode override.)
  if ((action === 'submitted' || action === 'manager_approved') && userRole !== 'admin') {
    const days = ((ts as any).timesheet_entries ?? []).map((e: any) => ({ date: e.entry_date, hours: Number(e.hours) || 0 }));
    const { blocking } = await detectLeaveConflictsForDays(ts.employee_id, days);
    if (blocking.length > 0) {
      throw new ConflictError(approvedLeaveBlockMessage(blocking), { code: 'TIMESHEET_ON_APPROVED_LEAVE', conflicts: blocking });
    }
  }

  const updateData: Record<string, unknown> = { status: input.status };
  if (input.status === 'submitted') updateData.submitted_at = new Date().toISOString();
  if (input.status === 'manager_approved') updateData.manager_approved_at = new Date().toISOString();
  if (input.status === 'rejected') {
    updateData.rejection_reason = input.rejectionReason ?? null;
  } else {
    updateData.rejection_reason = null;
  }

  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const label = ts.display_id ?? id.slice(0, 8);
  logActivity(actorId ?? null, 'status_changed', 'timesheet', id, label, { from: ts.status, to: input.status });
  bustNavBadgeCache();

  const actorIsOwner = actorEmployeeId != null && actorEmployeeId === ts.employee_id;
  await notifyTimesheetStatusChange(
    { id, employeeId: ts.employee_id, label },
    input.status,
    input.rejectionReason,
    actorIsOwner,
  );

  return data;
}

/**
 * Fire-and-forget notification dispatcher for timesheet status transitions.
 * Wraps everything in a try/catch so notification failures never break the
 * main state-change flow.  Called by both `patchTimesheetStatus` and
 * `bulkPatchTimesheetStatus`.
 */
async function notifyTimesheetStatusChange(
  ts: { id: string; employeeId: string; label: string },
  newStatus: string,
  rejectionReason?: string,
  actorIsOwner = true,
): Promise<void> {
  try {
    if (newStatus === 'submitted') {
      // Spec: the reporting manager gets a direct, targeted notification.
      const managerPortalId = await getReportingManagerPortalUserId(ts.employeeId);
      if (managerPortalId) {
        await createNotification(
          managerPortalId,
          'Timesheet Pending Your Approval',
          `Timesheet ${ts.label} from one of your direct reports is awaiting approval.`,
          'info', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`,
        );
      }
      // Safety-net broadcast to operations + admin, de-duped against the manager.
      const [opIds, adminIds] = await Promise.all([
        getUserIdsByRole('operations'),
        getUserIdsByRole('admin'),
      ]);
      const broadcast = [...new Set([...opIds, ...adminIds])].filter(uid => uid !== managerPortalId);
      await Promise.all(broadcast.map(uid =>
        createNotification(uid, 'Timesheet Submitted', `Timesheet ${ts.label} is awaiting your approval.`, 'info', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`)
      ));
      // Someone other than the employee (e.g. admin filling in on their
      // behalf) submitted this — let the owner know it happened.
      if (!actorIsOwner) {
        const ownerPortalId = await getPortalUserByEmployeeId(ts.employeeId);
        if (ownerPortalId) {
          await createNotification(
            ownerPortalId,
            'Timesheet Submitted On Your Behalf',
            `Timesheet ${ts.label} was filled in and submitted for you.`,
            'info', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`,
          );
        }
      }
    } else if (newStatus === 'manager_approved') {
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employeeId);
      if (ownerPortalId) {
        await createNotification(ownerPortalId, 'Timesheet Approved', `Timesheet ${ts.label} has been approved.`, 'success', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`);
      }
      const [financeIds, adminIds] = await Promise.all([
        getUserIdsByRole('finance'),
        getUserIdsByRole('admin'),
      ]);
      await Promise.all([...new Set([...financeIds, ...adminIds])].map(uid =>
        createNotification(uid, 'Timesheet Ready to Invoice', `Timesheet ${ts.label} is approved and ready to be invoiced.`, 'info', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`)
      ));
    } else if (newStatus === 'rejected') {
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employeeId);
      if (ownerPortalId) {
        const reason = rejectionReason ? `: "${rejectionReason}"` : '';
        await createNotification(ownerPortalId, 'Timesheet Rejected', `Timesheet ${ts.label} was rejected${reason}.`, 'error', 'timesheet', ts.id, `/portal/timesheets/${ts.id}`);
      }
    }
  } catch (err) {
    // Notification failure must not affect the main state-change flow, but log
    // it so operators can see that an expected alert was dropped.
    console.error('[timesheets.service] notification dispatch failed', { timesheetId: ts.id, newStatus, err });
  }
}

export async function deleteTimesheet(id: string, userRole: string, userId: string, actorEmployeeId?: string | null) {
  const ts = await getTimesheet(id);

  if (userRole === 'employee' && ts.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only delete your own timesheet.');
  }

  if (ts.status !== 'draft' && userRole !== 'admin') {
    throw new ForbiddenError('Only draft timesheets can be deleted');
  }

  const { error } = await supabaseAdmin
    .from('timesheets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export async function exportTimesheetsCSV(query: { status?: string; employeeId?: string; clientId?: string }): Promise<string> {
  let q = supabaseAdmin
    .from('timesheets')
    .select(`
      display_id, week_start_date, week_end_date, total_hours, status, submitted_at, notes,
      employees!inner(first_name, last_name, display_id),
      clients!inner(company_name, display_id)
    `)
    .order('week_start_date', { ascending: false });
  if (query.status) q = q.eq('status', query.status);
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.clientId) q = q.eq('client_id', query.clientId);
  const { data, error } = await q;
  if (error) throw error;

  const headers = ['Timesheet ID','Employee ID','Employee Name','Client ID','Client','Week Start','Week End','Total Hours','Status','Submitted At','Notes'];
  const rows = (data ?? []).map((t: any) => [
    t.display_id ?? '',
    t.employees?.display_id ?? '',
    `${t.employees?.first_name ?? ''} ${t.employees?.last_name ?? ''}`.trim(),
    t.clients?.display_id ?? '',
    t.clients?.company_name ?? '',
    t.week_start_date, t.week_end_date, t.total_hours, t.status,
    t.submitted_at ? new Date(t.submitted_at).toISOString().split('T')[0] : '',
    t.notes ?? '',
  ]);
  return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ── Bulk status patch ─────────────────────────────────────────────────────────

export async function bulkPatchTimesheetStatus(ids: string[], status: string, actorRole: string, actorEmployeeId?: string | null): Promise<{ updated: number; failed: string[] }> {
  const allowed: Record<string, string[]> = {
    submitted: ['draft', 'rejected'],
    manager_approved: ['submitted'],
    rejected: ['submitted', 'manager_approved'],
  };
  if (!allowed[status]) throw new Error(`Invalid target status: ${status}`);

  // Same per-transition role rules as the single patch path — without this,
  // a role could bulk-advance a status it shouldn't, bypassing the state
  // machine's role gates entirely.
  const roleFor: Record<string, string[]> = {
    submitted: ['employee', 'admin', 'operations'],
    manager_approved: ['admin', 'operations', 'hr'],
    rejected: ['admin', 'operations', 'finance', 'hr'],
  };
  if (!roleFor[status]?.includes(actorRole)) {
    throw new ForbiddenError(`Role '${actorRole}' cannot set status to '${status}'`);
  }

  // Fetch current rows including the fields we need for notifications
  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .select('id, status, employee_id, display_id')
    .in('id', ids);
  if (error) throw error;

  const eligibleRows = (data ?? []).filter(t => allowed[status].includes(t.status));
  const eligible = eligibleRows.map(t => t.id);
  const failed = ids.filter(id => !eligible.includes(id));

  if (eligible.length > 0) {
    const tsField: Record<string, string> = {
      submitted: 'submitted_at',
      manager_approved: 'manager_approved_at',
    };
    const updateData: Record<string, unknown> = { status };
    if (tsField[status]) updateData[tsField[status]] = new Date().toISOString();
    await supabaseAdmin.from('timesheets').update(updateData).in('id', eligible);

    bustNavBadgeCache();

    // Fire per-row notifications. Each call is wrapped inside the helper's
    // own try/catch so one failure cannot abort the batch.
    for (const row of eligibleRows) {
      const actorIsOwner = actorEmployeeId != null && actorEmployeeId === row.employee_id;
      await notifyTimesheetStatusChange(
        { id: row.id, employeeId: row.employee_id, label: row.display_id ?? row.id.slice(0, 8) },
        status,
        undefined,
        actorIsOwner,
      );
    }
  }

  return { updated: eligible.length, failed };
}

// ── Client-signed weekly-timesheet proof upload ────────────────────────────
//
// Mirrors the monthly proof flow. Required at submit-time when total_hours > 0;
// skipped when zero-hour (leave). Files live in storage.timesheet-proofs/weekly/<id>/.

const WEEKLY_PROOF_BUCKET = 'timesheet-proofs';
const WEEKLY_PROOF_URL_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function uploadWeeklyClientProof(
  id: string, file: Express.Multer.File, actorRole: string, actorEmployeeId: string | null, actorId?: string,
) {
  const ts = await getTimesheet(id);
  if (actorRole === 'employee' && ts.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only upload proof to your own timesheet.');
  }
  // Admin and operations can attach/replace the client-signed copy at any point
  // (operations manages it while reviewing a submitted timesheet); the employee
  // is limited to draft/rejected and to an open week.
  const privileged = actorRole === 'admin' || actorRole === 'operations';
  if (!privileged && !['draft', 'rejected'].includes(ts.status)) {
    throw new ForbiddenError('Proof can only be attached while the timesheet is in draft or rejected state.');
  }
  // No week-closed gate: timesheets are open from the joining week onward
  // (including elapsed-after-joining weeks for catch-up), so proof can be
  // attached to any draft/rejected week the employee is still completing.

  try {
    const { data: existing } = await supabaseAdmin.storage
      .from(WEEKLY_PROOF_BUCKET).list(`weekly/${id}/`, { limit: 100 });
    if (existing && existing.length > 0) {
      await supabaseAdmin.storage.from(WEEKLY_PROOF_BUCKET).remove(existing.map(f => `weekly/${id}/${f.name}`));
    }
  } catch (err) {
    console.error('[timesheets] old proof cleanup failed for', id, err);
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path = `weekly/${id}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabaseAdmin.storage.from(WEEKLY_PROOF_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabaseAdmin.storage.from(WEEKLY_PROOF_BUCKET)
    .createSignedUrl(path, WEEKLY_PROOF_URL_TTL_SECONDS);
  if (signErr) throw signErr;

  const { data: updated, error: dbErr } = await supabaseAdmin
    .from('timesheets')
    .update({ client_signed_url: signed.signedUrl, client_signed_filename: file.originalname })
    .eq('id', id).select().single();
  if (dbErr) throw dbErr;

  logActivity(actorId ?? null, 'uploaded_client_proof', 'timesheet', id, ts.display_id ?? id.slice(0, 8));
  return updated;
}

export async function deleteWeeklyClientProof(
  id: string, actorRole: string, actorEmployeeId: string | null, actorId?: string,
) {
  const ts = await getTimesheet(id);
  if (actorRole === 'employee' && ts.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only modify your own timesheet.');
  }
  // Admin and operations can remove the client-signed copy at any point (e.g.
  // operations clearing a wrong upload during review); the employee is limited
  // to draft/rejected.
  const privileged = actorRole === 'admin' || actorRole === 'operations';
  if (!privileged && !['draft', 'rejected'].includes(ts.status)) {
    throw new ForbiddenError('Proof can only be removed while the timesheet is in draft or rejected state.');
  }

  try {
    const { data: existing } = await supabaseAdmin.storage
      .from(WEEKLY_PROOF_BUCKET).list(`weekly/${id}/`, { limit: 100 });
    if (existing && existing.length > 0) {
      await supabaseAdmin.storage.from(WEEKLY_PROOF_BUCKET).remove(existing.map(f => `weekly/${id}/${f.name}`));
    }
  } catch (err) {
    console.error('[timesheets] proof file cleanup failed for', id, err);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('timesheets')
    .update({ client_signed_url: null, client_signed_filename: null })
    .eq('id', id).select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'removed_client_proof', 'timesheet', id, ts.display_id ?? id.slice(0, 8));
  return updated;
}

// Reopen an already-approved timesheet, handing it back to the employee to
// correct their actual hours (e.g. a future-dated timesheet was approved in
// advance, then the employee got sick and the real hours differ). Unlike
// monthly timesheets' patchEntriesByAdmin (HR silently overwrites entries in
// place), this hands control back to the EMPLOYEE — resets status to 'draft'
// so the existing draft/rejected edit gate in updateTimesheet just works,
// with no new status enum value or DB migration needed.
export async function reopenTimesheet(
  id: string, actorRole: string, actorId?: string, reason?: string,
) {
  const ts = await getTimesheet(id);
  if (ts.status !== 'manager_approved') {
    throw new ValidationError(`A '${ts.status}' timesheet cannot be reopened — only manager-approved timesheets can be.`);
  }

  // The previously-uploaded client-signed proof attested to the hours that
  // are about to change — clear it out (same cleanup as deleteWeeklyClientProof).
  try {
    const { data: existing } = await supabaseAdmin.storage
      .from(WEEKLY_PROOF_BUCKET).list(`weekly/${id}/`, { limit: 100 });
    if (existing && existing.length > 0) {
      await supabaseAdmin.storage.from(WEEKLY_PROOF_BUCKET).remove(existing.map(f => `weekly/${id}/${f.name}`));
    }
  } catch (err) {
    console.error('[timesheets] proof file cleanup failed while reopening', id, err);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('timesheets')
    .update({
      status: 'draft',
      manager_approved_at: null,
      client_signed_url: null,
      client_signed_filename: null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const label = ts.display_id ?? id.slice(0, 8);
  logActivity(actorId ?? null, 'updated', 'timesheet', id, label, { event: 'timesheet_reopened', from: ts.status, reason });
  bustNavBadgeCache();

  const ownerPortalId = await getPortalUserByEmployeeId(ts.employee_id);
  if (ownerPortalId) {
    const reasonSuffix = reason ? ` Reason: ${reason}` : '';
    await createNotification(
      ownerPortalId, 'Timesheet Reopened',
      `Your timesheet ${label} was reopened for corrections — please update your actual hours and resubmit.${reasonSuffix}`,
      'warning', 'timesheet', id, `/portal/timesheets/${id}`,
    );
  }

  return updated;
}
