import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';
import { isCurrentOrFutureWeekUTC, isWeekBeforeJoiningUTC, isFutureWeekUTC } from '../lib/dateUtils';
import { createNotification, getUserIdsByRole, getPortalUserByEmployeeId, getReportingManagerPortalUserId } from './notifications.service';
import { logActivity } from '../lib/activityLogger';
import type {
  CreateTimesheetInput, UpdateTimesheetInput,
  PatchTimesheetStatusInput, ListTimesheetsQuery,
} from '../schemas/timesheet.schema';

export async function listTimesheets(query: ListTimesheetsQuery, userRole?: string, userId?: string) {
  let q = supabaseAdmin.from('timesheets').select('*, timesheet_entries(*)', { count: 'exact' });

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

export async function getTimesheet(id: string) {
  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Timesheet not found');
  return data;
}

export async function createTimesheet(input: CreateTimesheetInput, actorRole?: string) {
  // Future-week lockout — NO ONE (incl. admin) can create a timesheet for a week
  // that hasn't started yet. You can't log hours for time that hasn't happened.
  if (isFutureWeekUTC(input.weekStartDate)) {
    throw new ValidationError(
      `Week of ${input.weekStartDate} hasn't started yet — you can't create a timesheet for a future week.`,
    );
  }
  // Period lockout — past weeks are read-only for everyone except admin.
  // Matches a strict corporate payroll cutoff. Admin can still backfill for
  // corrections via a separate audit-logged path.
  if (actorRole !== 'admin' && !isCurrentOrFutureWeekUTC(input.weekStartDate)) {
    throw new ValidationError(
      `Week of ${input.weekStartDate} is closed. Past timesheets cannot be created — contact your admin for a correction.`,
    );
  }
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

  // total_hours is computed server-side; ignore any client-supplied value.
  const totalHours = input.entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

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

  if (input.entries.length > 0) {
    const entries = input.entries.map(e => ({
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

export async function updateTimesheet(id: string, input: UpdateTimesheetInput, userRole?: string) {
  const ts = await getTimesheet(id);

  // Admin gets god-mode (can edit any status). Everyone else is bound by the
  // status machine — once a timesheet is submitted/approved, only admin can
  // silently rewrite hours. This trades audit safety for operational
  // flexibility; document it clearly to any auditor.
  if (userRole !== 'admin' && !['draft', 'rejected'].includes(ts.status)) {
    throw new ForbiddenError('Can only edit draft or rejected timesheets');
  }
  // Period lockout for non-admins.
  if (userRole !== 'admin' && !isCurrentOrFutureWeekUTC(ts.week_start_date)) {
    throw new ValidationError(
      `Week of ${ts.week_start_date} is closed. Past timesheets cannot be edited — contact your admin for a correction.`,
    );
  }

  const totalHours = input.entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  // Upsert entries — avoids duplicate-key errors from concurrent requests
  if (input.entries.length > 0) {
    const entries = input.entries.map(e => ({
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
) {
  const ts = await getTimesheet(id);

  // State machine: enforce valid transitions regardless of role
  const validTransitions: Record<string, string[]> = {
    draft:            ['submitted'],
    submitted:        ['manager_approved', 'rejected'],
    manager_approved: ['client_approved', 'rejected'],
    client_approved:  [],
    rejected:         ['submitted'],
  };
  if (!validTransitions[ts.status]?.includes(input.status)) {
    throw new ForbiddenError(`Cannot transition from '${ts.status}' to '${input.status}'`);
  }

  // Role-based status transition rules
  const allowed: Record<string, string[]> = {
    submitted:         ['employee', 'admin', 'operations'],
    manager_approved:  ['admin', 'operations'],
    client_approved:   ['admin', 'finance'],
    rejected:          ['admin', 'operations', 'finance'],
  };

  const action = input.status;
  if (!allowed[action]?.includes(userRole)) {
    throw new ForbiddenError(`Role '${userRole}' cannot set status to '${action}'`);
  }

  // Future-week lockout — NO ONE (incl. admin) can submit a timesheet for a week
  // that hasn't started yet.
  if (action === 'submitted' && isFutureWeekUTC(ts.week_start_date)) {
    throw new ValidationError(
      `Week of ${ts.week_start_date} hasn't started yet — you can't submit a timesheet for a future week.`,
    );
  }

  // Submit-time gates (only checked when transitioning into `submitted`):
  //  - Past weeks are read-only for non-admins.
  //  - Zero-hour weeks require leave_reason.
  //  - Non-zero weeks require a client-signed timesheet upload.
  if (action === 'submitted' && userRole !== 'admin') {
    if (!isCurrentOrFutureWeekUTC(ts.week_start_date)) {
      throw new ValidationError(
        `Week of ${ts.week_start_date} is closed. Past timesheets cannot be submitted — contact your admin for a correction.`,
      );
    }
    const hours = Number(ts.total_hours ?? 0);
    if (hours === 0 && !ts.leave_reason) {
      throw new ValidationError('Add a reason (e.g. medical leave, sick, unpaid leave) before submitting a zero-hour timesheet.');
    }
    if (hours > 0 && !ts.client_signed_url) {
      throw new ValidationError('Upload the client-signed timesheet before submitting.');
    }
  }

  const updateData: Record<string, unknown> = { status: input.status };
  if (input.status === 'submitted') updateData.submitted_at = new Date().toISOString();
  if (input.status === 'manager_approved') updateData.manager_approved_at = new Date().toISOString();
  if (input.status === 'client_approved') updateData.client_approved_at = new Date().toISOString();
  if (input.status === 'rejected') updateData.rejection_reason = input.rejectionReason ?? null;

  const { data, error } = await supabaseAdmin
    .from('timesheets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const label = ts.display_id ?? id.slice(0, 8);
  logActivity(actorId ?? null, 'status_changed', 'timesheet', id, label, { from: ts.status, to: input.status });

  await notifyTimesheetStatusChange(
    { id, employeeId: ts.employee_id, label },
    input.status,
    input.rejectionReason,
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
          'info', 'timesheet', ts.id,
        );
      }
      // Safety-net broadcast to operations + admin, de-duped against the manager.
      const opIds = await getUserIdsByRole('operations');
      const adminIds = await getUserIdsByRole('admin');
      const broadcast = [...new Set([...opIds, ...adminIds])].filter(uid => uid !== managerPortalId);
      for (const uid of broadcast) {
        await createNotification(uid, 'Timesheet Submitted', `Timesheet ${ts.label} is awaiting your approval.`, 'info', 'timesheet', ts.id);
      }
    } else if (newStatus === 'manager_approved') {
      const financeIds = await getUserIdsByRole('finance');
      const adminIds = await getUserIdsByRole('admin');
      for (const uid of [...new Set([...financeIds, ...adminIds])]) {
        await createNotification(uid, 'Timesheet Ready for Client Approval', `Timesheet ${ts.label} has been manager-approved.`, 'info', 'timesheet', ts.id);
      }
    } else if (newStatus === 'rejected') {
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employeeId);
      if (ownerPortalId) {
        const reason = rejectionReason ? `: "${rejectionReason}"` : '';
        await createNotification(ownerPortalId, 'Timesheet Rejected', `Timesheet ${ts.label} was rejected${reason}.`, 'error', 'timesheet', ts.id);
      }
    } else if (newStatus === 'client_approved') {
      // Notify the employee who owns the timesheet
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employeeId);
      if (ownerPortalId) {
        await createNotification(ownerPortalId, 'Timesheet Approved', `Timesheet ${ts.label} has been fully approved.`, 'success', 'timesheet', ts.id);
      }
      // Spec: finance users get realtime heads-up that this is ready to invoice.
      const financeIds = await getUserIdsByRole('finance');
      for (const uid of financeIds) {
        await createNotification(
          uid,
          'Timesheet Ready to Invoice',
          `Timesheet ${ts.label} is fully approved and ready to be invoiced.`,
          'info', 'timesheet', ts.id,
        );
      }
    }
  } catch (err) {
    // Notification failure must not affect the main state-change flow, but log
    // it so operators can see that an expected alert was dropped.
    console.error('[timesheets.service] notification dispatch failed', { timesheetId: ts.id, newStatus, err });
  }
}

export async function deleteTimesheet(id: string, userRole: string, userId: string) {
  const ts = await getTimesheet(id);

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

export async function bulkPatchTimesheetStatus(ids: string[], status: string, actorRole: string): Promise<{ updated: number; failed: string[] }> {
  const allowed: Record<string, string[]> = {
    submitted: ['draft', 'rejected'],
    manager_approved: ['submitted'],
    client_approved: ['manager_approved'],
    rejected: ['submitted', 'manager_approved'],
  };
  if (!allowed[status]) throw new Error(`Invalid target status: ${status}`);

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
      client_approved: 'client_approved_at',
    };
    const updateData: Record<string, unknown> = { status };
    if (tsField[status]) updateData[tsField[status]] = new Date().toISOString();
    await supabaseAdmin.from('timesheets').update(updateData).in('id', eligible);

    // Fire per-row notifications. Each call is wrapped inside the helper's
    // own try/catch so one failure cannot abort the batch.
    for (const row of eligibleRows) {
      await notifyTimesheetStatusChange(
        { id: row.id, employeeId: row.employee_id, label: row.display_id ?? row.id.slice(0, 8) },
        status,
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
  if (!privileged && !isCurrentOrFutureWeekUTC(ts.week_start_date)) {
    throw new ValidationError(`Week of ${ts.week_start_date} is closed.`);
  }

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
