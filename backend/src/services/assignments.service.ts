import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { createNotification, getPortalUserByEmployeeId, getUserIdsByRole } from './notifications.service';
import type { CreateAssignmentInput, UpdateAssignmentInput, ListAssignmentsQuery } from '../schemas/assignment.schema';

export async function listAssignments(query: ListAssignmentsQuery, userRole?: string, userId?: string) {
  let q = supabaseAdmin.from('assignments').select('*', { count: 'exact' });

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
  return { data: data ?? [], total: count ?? 0 };
}

export async function getAssignment(id: string) {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Assignment not found');
  return data;
}

export async function createAssignment(input: CreateAssignmentInput) {
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
      status: input.status,
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
  } catch (_) { /* non-blocking */ }

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
