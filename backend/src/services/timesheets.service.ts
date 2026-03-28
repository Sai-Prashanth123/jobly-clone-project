import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors';
import { createNotification, getUserIdsByRole, getPortalUserByEmployeeId } from './notifications.service';
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

export async function createTimesheet(input: CreateTimesheetInput) {
  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('timesheets')
    .select('id')
    .eq('employee_id', input.employeeId)
    .eq('assignment_id', input.assignmentId)
    .eq('week_start_date', input.weekStartDate)
    .maybeSingle();

  if (existing) throw new ConflictError('Timesheet already exists for this employee/assignment/week');

  const totalHours = input.entries.reduce((sum, e) => sum + e.hours, 0);

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
      status: 'draft',
    })
    .select()
    .single();

  if (tsError) throw tsError;

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

export async function updateTimesheet(id: string, input: UpdateTimesheetInput) {
  const ts = await getTimesheet(id);

  if (!['draft', 'rejected'].includes(ts.status)) {
    throw new ForbiddenError('Can only edit draft or rejected timesheets');
  }

  const totalHours = input.entries.reduce((sum, e) => sum + e.hours, 0);

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

  // Fire-and-forget notifications (non-blocking)
  try {
    if (input.status === 'submitted') {
      const opIds = await getUserIdsByRole('operations');
      const adminIds = await getUserIdsByRole('admin');
      for (const uid of [...new Set([...opIds, ...adminIds])]) {
        await createNotification(uid, 'Timesheet Submitted', `Timesheet ${label} is awaiting your approval.`, 'info', 'timesheet', id);
      }
    } else if (input.status === 'manager_approved') {
      const financeIds = await getUserIdsByRole('finance');
      const adminIds = await getUserIdsByRole('admin');
      for (const uid of [...new Set([...financeIds, ...adminIds])]) {
        await createNotification(uid, 'Timesheet Ready for Client Approval', `Timesheet ${label} has been manager-approved.`, 'info', 'timesheet', id);
      }
    } else if (input.status === 'rejected') {
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employee_id);
      if (ownerPortalId) {
        const reason = input.rejectionReason ? `: "${input.rejectionReason}"` : '';
        await createNotification(ownerPortalId, 'Timesheet Rejected', `Timesheet ${label} was rejected${reason}.`, 'error', 'timesheet', id);
      }
    } else if (input.status === 'client_approved') {
      const ownerPortalId = await getPortalUserByEmployeeId(ts.employee_id);
      if (ownerPortalId) {
        await createNotification(ownerPortalId, 'Timesheet Approved', `Timesheet ${label} has been fully approved.`, 'success', 'timesheet', id);
      }
    }
  } catch (_) { /* notification failure must not affect main flow */ }

  return data;
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

  const { data, error } = await supabaseAdmin.from('timesheets').select('id, status').in('id', ids);
  if (error) throw error;

  const eligible = (data ?? []).filter(t => allowed[status].includes(t.status)).map(t => t.id);
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
  }

  return { updated: eligible.length, failed };
}
