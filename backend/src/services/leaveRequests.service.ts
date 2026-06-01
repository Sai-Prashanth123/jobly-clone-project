import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';
import { parseDateUTC, addDaysToDate, formatDateSafe } from '../lib/dateUtils';
import {
  createNotification,
  getUserIdsByRole,
  getPortalUserByEmployeeId,
} from './notifications.service';
import { logActivity } from '../lib/activityLogger';
import type {
  CreateLeaveRequestInput,
  ReviewLeaveRequestInput,
  ListLeaveRequestsQuery,
} from '../schemas/leaveRequest.schema';

const SELECT = '*, employees!employee_id(first_name, last_name, display_id)';

/** Inclusive count of weekdays (Mon–Fri) between two YYYY-MM-DD dates. */
function businessDaysInclusive(start: string, end: string): number {
  let count = 0;
  let cursor = start;
  // Guard against an unbounded loop on bad input.
  for (let i = 0; i < 366 && cursor <= end; i++) {
    const dow = parseDateUTC(cursor).getUTCDay(); // 0=Sun … 6=Sat
    if (dow !== 0 && dow !== 6) count++;
    cursor = addDaysToDate(cursor, 1);
  }
  return count;
}

export async function listLeaveRequests(
  query: ListLeaveRequestsQuery,
  userRole: string,
  userEmployeeId?: string | null,
) {
  let q = supabaseAdmin.from('leave_requests').select(SELECT, { count: 'exact' });

  // Employees only ever see their own requests, regardless of query params.
  if (userRole === 'employee') {
    if (!userEmployeeId) return { data: [], total: 0 };
    q = q.eq('employee_id', userEmployeeId);
  } else if (query.employeeId) {
    q = q.eq('employee_id', query.employeeId);
  }
  if (query.status) q = q.eq('status', query.status);

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getLeaveRequest(id: string, userRole: string, userEmployeeId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('leave_requests').select(SELECT).eq('id', id).single();
  if (error || !data) throw new NotFoundError('Leave request not found');
  if (userRole === 'employee' && data.employee_id !== userEmployeeId) {
    throw new ForbiddenError('You may only view your own leave requests.');
  }
  return data;
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
  actorRole: string,
  actorEmployeeId?: string | null,
  actorId?: string,
) {
  // Resolve whose leave this is. Employees can only file for themselves; admin/hr
  // may file on behalf of an employee by passing employeeId.
  let employeeId = input.employeeId;
  if (actorRole === 'employee') {
    if (!actorEmployeeId) throw new ForbiddenError('Only employees with a linked record can request leave.');
    employeeId = actorEmployeeId;
  }
  if (!employeeId) throw new ValidationError('employeeId is required.');

  const { data: emp } = await supabaseAdmin
    .from('employees').select('id, first_name, last_name, display_id').eq('id', employeeId).maybeSingle();
  if (!emp) throw new NotFoundError('Employee not found');

  const days = businessDaysInclusive(input.startDate, input.endDate);

  const { data: lr, error } = await supabaseAdmin
    .from('leave_requests')
    .insert({
      employee_id: employeeId,
      leave_type: input.leaveType,
      start_date: input.startDate,
      end_date: input.endDate,
      days_requested: days,
      reason: input.reason ?? null,
      status: 'pending',
    })
    .select(SELECT)
    .single();
  if (error) throw error;

  const empName = `${emp.first_name} ${emp.last_name}`.trim();
  const label = lr.display_id ?? lr.id.slice(0, 8);
  logActivity(actorId ?? null, 'created', 'leave_request', lr.id, label, { employee: emp.display_id });

  // Notify HR + admin that a request is awaiting review.
  const reviewers = [...new Set([...(await getUserIdsByRole('admin')), ...(await getUserIdsByRole('hr'))])];
  const window = `${formatDateSafe(input.startDate)} – ${formatDateSafe(input.endDate)}`;
  await Promise.all(
    reviewers.map(uid =>
      createNotification(
        uid,
        'Leave request submitted',
        `${empName} (${emp.display_id ?? ''}) requested ${days} day${days === 1 ? '' : 's'} of leave (${window}). Review it under Leave Requests.`,
        'info', 'leave_request', lr.id,
      ),
    ),
  );

  return lr;
}

export async function reviewLeaveRequest(
  id: string,
  input: ReviewLeaveRequestInput,
  reviewerUserId?: string,
) {
  const { data: lr, error: findErr } = await supabaseAdmin
    .from('leave_requests').select(SELECT).eq('id', id).single();
  if (findErr || !lr) throw new NotFoundError('Leave request not found');
  if (lr.status !== 'pending') {
    throw new ValidationError(`This request has already been ${lr.status}.`);
  }
  if (input.status === 'rejected' && !input.rejectionReason) {
    throw new ValidationError('Add a reason when rejecting a leave request.');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('leave_requests')
    .update({
      status: input.status,
      reviewed_by: reviewerUserId ?? null,
      reviewed_at: new Date().toISOString(),
      rejection_reason: input.status === 'rejected' ? input.rejectionReason : null,
    })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw error;

  const label = lr.display_id ?? id.slice(0, 8);
  logActivity(reviewerUserId ?? null, 'status_changed', 'leave_request', id, label, { to: input.status });

  // Notify the employee of the decision.
  const empUserId = await getPortalUserByEmployeeId(lr.employee_id);
  if (empUserId) {
    const window = `${formatDateSafe(lr.start_date)} – ${formatDateSafe(lr.end_date)}`;
    if (input.status === 'approved') {
      await createNotification(
        empUserId, 'Leave approved',
        `Your leave request ${label} (${window}) was approved.`,
        'success', 'leave_request', id,
      );
    } else {
      await createNotification(
        empUserId, 'Leave rejected',
        `Your leave request ${label} (${window}) was rejected. Reason: ${input.rejectionReason}`,
        'error', 'leave_request', id,
      );
    }
  }

  return updated;
}

export async function cancelLeaveRequest(
  id: string,
  userRole: string,
  userEmployeeId?: string | null,
  actorId?: string,
) {
  const { data: lr, error: findErr } = await supabaseAdmin
    .from('leave_requests').select('*').eq('id', id).single();
  if (findErr || !lr) throw new NotFoundError('Leave request not found');
  if (userRole === 'employee' && lr.employee_id !== userEmployeeId) {
    throw new ForbiddenError('You may only cancel your own leave requests.');
  }
  if (lr.status !== 'pending') {
    throw new ValidationError(`Only a pending request can be cancelled (this one is ${lr.status}).`);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'status_changed', 'leave_request', id, lr.display_id ?? id.slice(0, 8), { to: 'cancelled' });
  return updated;
}
