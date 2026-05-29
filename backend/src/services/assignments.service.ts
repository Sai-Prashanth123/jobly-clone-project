import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { todayUTC } from '../lib/dateUtils';
import { createNotification, getPortalUserByEmployeeId, getUserIdsByRole } from './notifications.service';
import type { CreateAssignmentInput, UpdateAssignmentInput, ListAssignmentsQuery } from '../schemas/assignment.schema';

// Joined select: pull the employee + client names alongside the assignment so
// the list/detail never needs a per-row fetch (kills the N+1 + the 404 spam
// when an assignment references a soft-deleted employee — the join still
// returns the name because it doesn't filter on the child's deleted_at).
// `employees!employee_id` disambiguates the embed — assignments has TWO FKs to
// employees (employee_id + reporting_manager_id), so a bare `employees(...)`
// embed is ambiguous and 500s. The column hint pins it to the assignee.
const ASSIGNMENT_SELECT = '*, employees!employee_id(first_name, last_name, display_id), clients(company_name)';

// Flatten the joined rows to snake_case fields the frontend mapper reads, and
// overlay a read-time "completed" status: if the engagement's end date has
// passed and it's still active/pending, present it as completed. Display-only —
// we never write it, so there are no update races and the Edit form still shows
// the stored value (admin/ops set the real end-state explicitly).
function decorateAssignment(row: any): any {
  const emp = row.employees;
  const cli = row.clients;
  let status = row.status;
  if (row.end_date && row.end_date < todayUTC() && (status === 'active' || status === 'pending')) {
    status = 'completed';
  }
  return {
    ...row,
    status,
    employee_name: emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : null,
    employee_display_id: emp?.display_id ?? null,
    client_name: cli?.company_name ?? null,
    employees: undefined,
    clients: undefined,
  };
}

export async function listAssignments(query: ListAssignmentsQuery, userRole?: string, userId?: string) {
  let q = supabaseAdmin.from('assignments').select(ASSIGNMENT_SELECT, { count: 'exact' });

  // Employees can only see their own assignments
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

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map(decorateAssignment), total: count ?? 0 };
}

export async function getAssignment(id: string) {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Assignment not found');
  return decorateAssignment(data);
}

export async function createAssignment(input: CreateAssignmentInput) {
  // Status is derived from the dates, NOT taken from the client — a new
  // assignment is Pending if its start date is in the future, otherwise Active.
  // (Completed/Terminated are end-states an admin/ops sets later via edit; the
  // read-time overlay also shows Completed once the end date passes.) This
  // prevents the "brand-new assignment shows Completed" confusion.
  const derivedStatus = input.startDate > todayUTC() ? 'pending' : 'active';

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      employee_id: input.employeeId,
      client_id: input.clientId,
      project_name: input.projectName,
      role: input.role,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      bill_rate: input.billRate,
      pay_rate: input.payRate,
      max_hours_per_week: input.maxHoursPerWeek,
      status: derivedStatus,
      billing_type: input.billingType ?? null,
      work_location: input.workLocation ?? null,
      reporting_manager_id: input.reportingManagerId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Notify the assigned employee (fire-and-forget)
  try {
    const { data: client } = await supabaseAdmin
      .from('clients').select('company_name').eq('id', input.clientId).single();
    const empPortalId = await getPortalUserByEmployeeId(input.employeeId);
    if (empPortalId) {
      await createNotification(
        empPortalId,
        'New Project Assignment',
        `You have been assigned to "${input.projectName}" at ${client?.company_name ?? 'a client'} as ${input.role}. Start date: ${input.startDate}.`,
        'info', 'assignment', data.id,
      );
    }
    // Also notify operations/admin
    const opsIds = await getUserIdsByRole('operations');
    const adminIds = await getUserIdsByRole('admin');
    const label = data.display_id ?? data.id.slice(0, 8);
    for (const uid of [...new Set([...opsIds, ...adminIds])]) {
      await createNotification(
        uid,
        'Assignment Created',
        `Assignment ${label} created for "${input.projectName}" at ${client?.company_name ?? 'a client'}.`,
        'success', 'assignment', data.id,
      );
    }
  } catch (err) {
    console.error('[assignments.service] notification failed for assignment', data.id, err);
  }

  return data;
}

export async function updateAssignment(id: string, input: UpdateAssignmentInput) {
  const existing = await getAssignment(id);
  if (!existing) throw new NotFoundError('Assignment not found');

  const updateData: Record<string, unknown> = {};
  if (input.employeeId !== undefined) updateData.employee_id = input.employeeId;
  if (input.clientId !== undefined) updateData.client_id = input.clientId;
  if (input.projectName !== undefined) updateData.project_name = input.projectName;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.startDate !== undefined) updateData.start_date = input.startDate;
  if (input.endDate !== undefined) updateData.end_date = input.endDate;
  if (input.billRate !== undefined) updateData.bill_rate = input.billRate;
  if (input.payRate !== undefined) updateData.pay_rate = input.payRate;
  if (input.maxHoursPerWeek !== undefined) updateData.max_hours_per_week = input.maxHoursPerWeek;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.billingType !== undefined) updateData.billing_type = input.billingType;
  if (input.workLocation !== undefined) updateData.work_location = input.workLocation;
  if (input.reportingManagerId !== undefined) updateData.reporting_manager_id = input.reportingManagerId;

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAssignment(id: string) {
  const existing = await getAssignment(id);
  if (!existing) throw new NotFoundError('Assignment not found');

  const { error } = await supabaseAdmin
    .from('assignments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
