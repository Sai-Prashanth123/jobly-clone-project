import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';
import { isCurrentOrFutureMonthUTC, isMonthBeforeJoiningUTC } from '../lib/dateUtils';
import {
  createNotification, getUserIdsByRole,
  getPortalUserByEmployeeId, getReportingManagerPortalUserId,
} from './notifications.service';
import { logActivity } from '../lib/activityLogger';
import { sendMonthlyTimesheetEmail, mailerConfigured } from '../lib/mailer';
import { generateMonthlyTimesheetPDF } from '../lib/pdfGenerator';
import { env } from '../config/env';
import type {
  UpsertMonthlyTimesheetInput, UpdateMonthlyTimesheetInput,
  PatchMonthlyStatusInput, ListMonthlyTimesheetsQuery,
} from '../schemas/monthlyTimesheet.schema';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthlyEntry {
  date: string; dayOfWeek: string; project?: string; task?: string;
  startTime?: string; endTime?: string; hours: number; status: string;
}

function monthLabel(year: number, month: number): string {
  return `${MONTHS[(month - 1 + 12) % 12]} ${year}`;
}

// Single source of truth for the summary numbers — never trust client totals.
// Working days = non-weekend, non-holiday (present + leave + absent).
// Total hours = sum of present-day hours. Expected = working_days × 8.
function computeSummary(entries: MonthlyEntry[]) {
  let total = 0, working = 0, leave = 0;
  for (const e of entries ?? []) {
    if (e.status === 'weekend' || e.status === 'holiday') continue;
    working++;
    if (e.status === 'leave') leave++;
    if (e.status === 'present') total += Number(e.hours) || 0;
  }
  return {
    total_hours: Math.round(total * 100) / 100,
    expected_hours: working * 8,
    working_days: working,
    leave_days: leave,
  };
}

async function resolveActorEmployeeId(actorId?: string): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await supabaseAdmin
    .from('portal_users').select('employee_id').eq('id', actorId).maybeSingle();
  return data?.employee_id ?? null;
}

async function resolveHrEmails(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('portal_users').select('email').eq('role', 'hr');
  const emails = (data ?? []).map(u => u.email).filter(Boolean) as string[];
  if (emails.length > 0) return emails;
  return env.HR_FALLBACK_EMAIL ? [env.HR_FALLBACK_EMAIL] : [];
}

// ── Reads ───────────────────────────────────────────────────────────────────

const EMP_JOIN = '*, employees(first_name, last_name, display_id, department)';

/** True when `managerEmployeeId` is the reporting manager of `employeeId`. */
export async function isReportingManagerOf(managerEmployeeId: string | null | undefined, employeeId: string): Promise<boolean> {
  if (!managerEmployeeId) return false;
  const { data } = await supabaseAdmin
    .from('employees').select('reporting_manager_id').eq('id', employeeId).maybeSingle();
  return data?.reporting_manager_id === managerEmployeeId;
}

export async function listMonthlyTimesheets(query: ListMonthlyTimesheetsQuery, userRole?: string, userId?: string) {
  let q = supabaseAdmin.from('monthly_timesheets').select(EMP_JOIN, { count: 'exact' });

  // Employees see their OWN sheets plus those of their direct reports (so a
  // reporting manager can review). Everyone else (admin/hr/operations) sees all.
  if (userRole === 'employee' && userId) {
    const empId = await resolveActorEmployeeId(userId);
    if (!empId) return { data: [], total: 0 };
    const { data: reports } = await supabaseAdmin
      .from('employees').select('id').eq('reporting_manager_id', empId);
    const ids = [empId, ...(reports ?? []).map(r => r.id)];
    q = q.in('employee_id', ids);
  }

  if (query.status) q = q.eq('status', query.status);
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.year) q = q.eq('year', query.year);
  if (query.month) q = q.eq('month', query.month);

  const offset = (query.page - 1) * query.limit;
  q = q.order('year', { ascending: false }).order('month', { ascending: false })
    .range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getMonthlyTimesheet(id: string) {
  const { data, error } = await supabaseAdmin
    .from('monthly_timesheets').select(EMP_JOIN).eq('id', id).single();
  if (error || !data) throw new NotFoundError('Monthly timesheet not found');
  return data;
}

export async function getMyMonth(employeeId: string | null | undefined, year: number, month: number) {
  if (!employeeId) return null;
  const { data } = await supabaseAdmin
    .from('monthly_timesheets').select('*')
    .eq('employee_id', employeeId).eq('year', year).eq('month', month)
    .maybeSingle();
  return data ?? null;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function upsertMonthlyTimesheet(
  input: UpsertMonthlyTimesheetInput, actorRole: string, actorEmployeeId: string | null, actorId?: string,
) {
  const targetEmployee = actorRole === 'employee'
    ? actorEmployeeId
    : (input.employeeId ?? actorEmployeeId);
  if (!targetEmployee) throw new ForbiddenError('No employee record is linked to this account.');

  // Period lockout — past months are read-only for everyone except admin.
  // Matches a strict corporate payroll cutoff: once a month closes, employees
  // and HR cannot retroactively edit; admin overrides exist for corrections.
  if (actorRole !== 'admin' && !isCurrentOrFutureMonthUTC(input.year, input.month)) {
    throw new ValidationError(
      `${monthLabel(input.year, input.month)} is closed. Past timesheets cannot be edited — contact your admin for a correction.`,
    );
  }
  // Date-of-joining floor — can't file a timesheet for a month before hire.
  if (actorRole !== 'admin') {
    const { data: empJoin } = await supabaseAdmin
      .from('employees').select('start_date').eq('id', targetEmployee).maybeSingle();
    if (isMonthBeforeJoiningUTC(input.year, input.month, empJoin?.start_date)) {
      throw new ValidationError(`Timesheets can't start before the joining date (${empJoin?.start_date}).`);
    }
  }

  const summary = computeSummary(input.entries as MonthlyEntry[]);

  const { data: existing } = await supabaseAdmin
    .from('monthly_timesheets').select('id, status, display_id')
    .eq('employee_id', targetEmployee).eq('year', input.year).eq('month', input.month)
    .maybeSingle();

  if (existing) {
    if (actorRole !== 'admin' && !['draft', 'rejected'].includes(existing.status)) {
      throw new ForbiddenError('This timesheet has been submitted and can no longer be edited.');
    }
    const { data, error } = await supabaseAdmin
      .from('monthly_timesheets')
      .update({
        entries: input.entries, notes: input.notes ?? null,
        leave_reason: input.leaveReason ?? null,
        ...summary,
      })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    logActivity(actorId ?? null, 'updated', 'monthly_timesheet', existing.id, existing.display_id ?? existing.id.slice(0, 8));
    return data;
  }

  // Race-safe: 23505 from the UNIQUE(employee_id, year, month) constraint is
  // returned as ConflictError to the caller (#1 from the edge-case audit).
  let attempt = 0;
  while (true) {
    attempt++;
    const { data, error } = await supabaseAdmin
      .from('monthly_timesheets')
      .insert({
        employee_id: targetEmployee, year: input.year, month: input.month,
        entries: input.entries, notes: input.notes ?? null,
        leave_reason: input.leaveReason ?? null,
        status: 'draft', ...summary,
      })
      .select().single();
    if (error) {
      if ((error as any).code === '23505' && attempt === 1) {
        // Two simultaneous upserts raced; re-run the existing-row path once.
        const { data: now } = await supabaseAdmin
          .from('monthly_timesheets').select('id, status, display_id')
          .eq('employee_id', targetEmployee).eq('year', input.year).eq('month', input.month)
          .maybeSingle();
        if (now) {
          const { data: updated, error: updErr } = await supabaseAdmin
            .from('monthly_timesheets')
            .update({
              entries: input.entries, notes: input.notes ?? null,
              leave_reason: input.leaveReason ?? null,
              ...summary,
            })
            .eq('id', now.id).select().single();
          if (updErr) throw updErr;
          logActivity(actorId ?? null, 'updated', 'monthly_timesheet', now.id, now.display_id ?? now.id.slice(0, 8));
          return updated;
        }
        throw new ConflictError('A timesheet already exists for this employee and month.');
      }
      throw error;
    }
    logActivity(actorId ?? null, 'created', 'monthly_timesheet', data.id, data.display_id ?? data.id.slice(0, 8));
    return data;
  }
}

export async function updateMonthlyTimesheet(id: string, input: UpdateMonthlyTimesheetInput, actorRole: string, actorId?: string) {
  const row = await getMonthlyTimesheet(id);
  if (actorRole !== 'admin' && !['draft', 'rejected'].includes(row.status)) {
    throw new ForbiddenError('Only draft or rejected timesheets can be edited.');
  }
  if (actorRole !== 'admin' && !isCurrentOrFutureMonthUTC(row.year, row.month)) {
    throw new ValidationError(
      `${monthLabel(row.year, row.month)} is closed. Past timesheets cannot be edited — contact your admin for a correction.`,
    );
  }
  const summary = computeSummary(input.entries as MonthlyEntry[]);
  const { data, error } = await supabaseAdmin
    .from('monthly_timesheets')
    .update({
      entries: input.entries, notes: input.notes ?? null,
      leave_reason: input.leaveReason ?? null,
      ...summary,
    })
    .eq('id', id).select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'monthly_timesheet', id, row.display_id ?? id.slice(0, 8));
  return data;
}

export async function submitMonthlyTimesheet(id: string, actorRole: string, actorId: string, actorEmployeeId: string | null) {
  const row = await getMonthlyTimesheet(id);
  if (!['draft', 'rejected'].includes(row.status)) {
    throw new ForbiddenError(`A '${row.status}' timesheet cannot be submitted.`);
  }
  // Employees may only submit their own; admin/HR may submit on an employee's behalf.
  if (actorRole === 'employee' && row.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only submit your own timesheet.');
  }
  if (actorRole !== 'admin' && !isCurrentOrFutureMonthUTC(row.year, row.month)) {
    throw new ValidationError(
      `${monthLabel(row.year, row.month)} is closed. Past timesheets cannot be submitted — contact your admin for a correction.`,
    );
  }
  // Submit-time gates:
  //  - Zero-hour periods (employee on leave) require leave_reason.
  //  - Non-zero periods require a client-signed timesheet upload as proof.
  //    If hours = 0 (leave / medical), the upload requirement is skipped —
  //    no work means no client signature exists.
  if ((row.total_hours ?? 0) === 0 && !row.leave_reason) {
    throw new ValidationError('Add a reason (e.g. medical leave, sick, unpaid leave) before submitting a zero-hour timesheet.');
  }
  if ((row.total_hours ?? 0) > 0 && !row.client_signed_url) {
    throw new ValidationError('Upload the client-signed timesheet before submitting.');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('monthly_timesheets')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), rejection_reason: null })
    .eq('id', id).select().single();
  if (error) throw error;

  const label = row.display_id ?? id.slice(0, 8);
  logActivity(actorId ?? null, 'status_changed', 'monthly_timesheet', id, label, { from: row.status, to: 'submitted' });

  // Side-effects (PDF generation + manager/HR notification email) never block
  // the submit response — a slow PDF/SMTP must not delay (or 504) the employee's
  // submission. Fire-and-forget; failures are logged.
  void runSubmitSideEffects(updated).catch(err =>
    console.error('[monthlyTimesheets] submit side-effects failed for', id, err));
  return { row: updated, emailSent: true, warning: undefined };
}

export async function patchMonthlyStatus(id: string, input: PatchMonthlyStatusInput, actorRole: string, actorId: string) {
  const row = await getMonthlyTimesheet(id);
  if (row.status !== 'submitted') {
    throw new ForbiddenError(`Only a submitted timesheet can be ${input.status}.`);
  }

  // Either HR/admin, or the employee's own reporting manager, may review.
  let allowed = actorRole === 'hr' || actorRole === 'admin';
  if (!allowed) {
    const managerPortalId = await getReportingManagerPortalUserId(row.employee_id);
    allowed = !!managerPortalId && managerPortalId === actorId;
  }
  if (!allowed) throw new ForbiddenError('Only the reporting manager or HR can review this timesheet.');

  const update: Record<string, unknown> = {
    status: input.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: actorId,
    rejection_reason: input.status === 'rejected' ? (input.rejectionReason ?? null) : null,
  };
  const { data, error } = await supabaseAdmin
    .from('monthly_timesheets').update(update).eq('id', id).select().single();
  if (error) throw error;

  const label = row.display_id ?? id.slice(0, 8);
  logActivity(actorId ?? null, 'status_changed', 'monthly_timesheet', id, label, { from: row.status, to: input.status });

  // Notify the owner (fire-and-forget).
  try {
    const ownerPortalId = await getPortalUserByEmployeeId(row.employee_id);
    if (ownerPortalId) {
      if (input.status === 'approved') {
        await createNotification(ownerPortalId, 'Attendance Approved',
          `Your ${monthLabel(row.year, row.month)} timesheet (${label}) was approved.`,
          'success', 'monthly_timesheet', id);
      } else {
        const reason = input.rejectionReason ? `: "${input.rejectionReason}"` : '';
        await createNotification(ownerPortalId, 'Attendance Rejected',
          `Your ${monthLabel(row.year, row.month)} timesheet (${label}) was rejected${reason}. Please correct and resubmit.`,
          'error', 'monthly_timesheet', id);
      }
    }
  } catch (err) {
    console.error('[monthlyTimesheets.service] review notification failed', { id, status: input.status, err });
  }

  return data;
}

// ── PDF ───────────────────────────────────────────────────────────────────

async function fetchEmployeeMeta(employeeId: string) {
  const { data } = await supabaseAdmin
    .from('employees')
    .select('first_name, last_name, display_id, department, reporting_manager_id')
    .eq('id', employeeId).maybeSingle();
  return data;
}

function rowsForReport(entries: MonthlyEntry[]) {
  // Reference omits weekends from the report; keep everything else.
  return (entries ?? [])
    .filter(e => e.status !== 'weekend')
    .map(e => ({
      date: e.date, day: e.dayOfWeek,
      project: e.project ?? '', task: e.task ?? '',
      start: e.startTime ?? '', end: e.endTime ?? '',
      hours: e.status === 'present' ? (Number(e.hours) || 0) : 0,
      status: e.status,
    }));
}

export async function generateAndStoreMonthlyPdf(row: any): Promise<string | null> {
  const emp = await fetchEmployeeMeta(row.employee_id);
  const employeeName = emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : 'Employee';
  const buffer = await generateMonthlyTimesheetPDF({
    displayId: row.display_id,
    employeeName,
    employeeDisplayId: emp?.display_id ?? '',
    department: emp?.department ?? undefined,
    monthLabel: monthLabel(row.year, row.month),
    rows: rowsForReport(row.entries as MonthlyEntry[]),
    totalHours: Number(row.total_hours) || 0,
    expectedHours: Number(row.expected_hours) || 0,
    balance: (Number(row.total_hours) || 0) - (Number(row.expected_hours) || 0),
    workingDays: row.working_days ?? 0,
    leaveDays: row.leave_days ?? 0,
    notes: row.notes ?? undefined,
  });

  const fileName = `${row.display_id}.pdf`;
  const { error: uploadError } = await supabaseAdmin
    .storage.from('monthly-timesheets')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = await supabaseAdmin
    .storage.from('monthly-timesheets')
    // `download` → Content-Disposition: attachment so the link saves the PDF
    // (under its real name) instead of opening inline in a tab.
    .createSignedUrl(fileName, 7 * 24 * 60 * 60, { download: fileName });

  await supabaseAdmin.from('monthly_timesheets').update({ pdf_url: urlData?.signedUrl }).eq('id', row.id);
  return urlData?.signedUrl ?? null;
}

export async function getMonthlyTimesheetPDF(id: string): Promise<string | null> {
  const row = await getMonthlyTimesheet(id);
  return generateAndStoreMonthlyPdf(row);
}

// ── Submit side-effects (each guarded; never breaks the submission) ─────────

async function runSubmitSideEffects(row: any): Promise<{ emailSent: boolean; warning?: string }> {
  const label = row.display_id ?? row.id.slice(0, 8);
  const emp = await fetchEmployeeMeta(row.employee_id);
  const employeeName = emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : 'Employee';
  const ml = monthLabel(row.year, row.month);
  let emailSent = false;
  let warning: string | undefined;

  // 1) PDF
  let pdfUrl: string | null = null;
  try {
    pdfUrl = await generateAndStoreMonthlyPdf(row);
  } catch (err) {
    console.error('[monthlyTimesheets.service] PDF generation failed', { id: row.id, err });
  }

  // 2) + 3) In-app notifications: reporting manager + all HR (de-duped)
  try {
    const managerPortalId = await getReportingManagerPortalUserId(row.employee_id);
    const hrIds = await getUserIdsByRole('hr');
    const recipients = [...new Set([managerPortalId, ...hrIds].filter(Boolean) as string[])];
    for (const uid of recipients) {
      await createNotification(
        uid,
        'Monthly Timesheet Submitted',
        `${employeeName} submitted their ${ml} timesheet (${label}) for review.`,
        'info', 'monthly_timesheet', row.id,
      );
    }
  } catch (err) {
    console.error('[monthlyTimesheets.service] notification dispatch failed', { id: row.id, err });
  }

  // 4) Email HR
  try {
    const hrEmails = await resolveHrEmails();
    if (!mailerConfigured) {
      warning = `Timesheet ${label} submitted. Email is not configured, so HR was notified in-app only.`;
    } else if (hrEmails.length === 0) {
      warning = `Timesheet ${label} submitted. No HR email is configured, so the report email was skipped.`;
    } else {
      await sendMonthlyTimesheetEmail({
        to: hrEmails,
        employeeName,
        employeeDisplayId: emp?.display_id ?? '',
        department: emp?.department ?? undefined,
        monthLabel: ml,
        totalHours: Number(row.total_hours) || 0,
        expectedHours: Number(row.expected_hours) || 0,
        balance: (Number(row.total_hours) || 0) - (Number(row.expected_hours) || 0),
        workingDays: row.working_days ?? 0,
        leaveDays: row.leave_days ?? 0,
        status: row.status,
        pdfUrl: pdfUrl ?? undefined,
        rows: rowsForReport(row.entries as MonthlyEntry[]),
      });
      emailSent = true;
    }
  } catch (err) {
    console.error('[monthlyTimesheets.service] HR email failed', { id: row.id, err });
    warning = `Timesheet ${label} submitted, but the HR email could not be delivered.`;
  }

  return { emailSent, warning };
}

// ── Client-signed-timesheet proof upload ───────────────────────────────────
//
// Employees attach the client-signed copy of their monthly timesheet (PDF /
// image / DOC) as proof. Required at submit-time when total_hours > 0; hidden
// + skipped when the period is zero-hours (employee was on leave / medical).

const PROOF_BUCKET = 'timesheet-proofs';
const PROOF_URL_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function uploadMonthlyClientProof(
  id: string, file: Express.Multer.File, actorRole: string, actorEmployeeId: string | null, actorId?: string,
) {
  const row = await getMonthlyTimesheet(id);
  if (actorRole === 'employee' && row.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only upload proof to your own timesheet.');
  }
  if (actorRole !== 'admin' && !['draft', 'rejected'].includes(row.status)) {
    throw new ForbiddenError('Proof can only be attached while the timesheet is in draft or rejected state.');
  }
  if (actorRole !== 'admin' && !isCurrentOrFutureMonthUTC(row.year, row.month)) {
    throw new ValidationError(
      `${monthLabel(row.year, row.month)} is closed. Past timesheets cannot be modified.`,
    );
  }

  // Delete the previous proof (best-effort) so storage doesn't accumulate
  // orphan files when employees re-upload.
  try {
    const { data: existing } = await supabaseAdmin.storage
      .from(PROOF_BUCKET).list(`monthly/${id}/`, { limit: 100 });
    if (existing && existing.length > 0) {
      await supabaseAdmin.storage.from(PROOF_BUCKET).remove(existing.map(f => `monthly/${id}/${f.name}`));
    }
  } catch (err) {
    console.error('[monthlyTimesheets] old proof cleanup failed for', id, err);
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path = `monthly/${id}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabaseAdmin.storage.from(PROOF_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabaseAdmin.storage.from(PROOF_BUCKET)
    .createSignedUrl(path, PROOF_URL_TTL_SECONDS);
  if (signErr) throw signErr;

  const { data: updated, error: dbErr } = await supabaseAdmin
    .from('monthly_timesheets')
    .update({ client_signed_url: signed.signedUrl, client_signed_filename: file.originalname })
    .eq('id', id).select().single();
  if (dbErr) throw dbErr;

  logActivity(actorId ?? null, 'uploaded_client_proof', 'monthly_timesheet', id, row.display_id ?? id.slice(0, 8));
  return updated;
}

export async function deleteMonthlyClientProof(
  id: string, actorRole: string, actorEmployeeId: string | null, actorId?: string,
) {
  const row = await getMonthlyTimesheet(id);
  if (actorRole === 'employee' && row.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only modify your own timesheet.');
  }
  if (actorRole !== 'admin' && !['draft', 'rejected'].includes(row.status)) {
    throw new ForbiddenError('Proof can only be removed while the timesheet is in draft or rejected state.');
  }

  try {
    const { data: existing } = await supabaseAdmin.storage
      .from(PROOF_BUCKET).list(`monthly/${id}/`, { limit: 100 });
    if (existing && existing.length > 0) {
      await supabaseAdmin.storage.from(PROOF_BUCKET).remove(existing.map(f => `monthly/${id}/${f.name}`));
    }
  } catch (err) {
    console.error('[monthlyTimesheets] proof file cleanup failed for', id, err);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('monthly_timesheets')
    .update({ client_signed_url: null, client_signed_filename: null })
    .eq('id', id).select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'removed_client_proof', 'monthly_timesheet', id, row.display_id ?? id.slice(0, 8));
  return updated;
}
