import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { createNotification } from './notifications.service';
import { getPortalUserByEmployeeId, getUserIdsByRole } from './notifications.service';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { bustNavBadgeCache } from './navBadges.service';
import type { CreateExpenseInput, UpdateExpenseInput, ReviewExpenseInput, ListExpensesQuery } from '../schemas/expenses.schema';

const RECEIPT_BUCKET = 'expense-receipts';

// receipt_url holds either a legacy pasted external link (from the old
// "Receipt URL" text field — starts with http(s)://, returned as-is) or an
// internal storage path from an uploaded file (resolved to a fresh signed
// URL on every read, same download-forcing pattern as documents).
async function resolveReceiptUrl(row: any): Promise<any> {
  if (!row?.receipt_url || /^https?:\/\//i.test(row.receipt_url)) return row;
  const { data } = await supabaseAdmin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(row.receipt_url, 3600, { download: true });
  return { ...row, receipt_url: data?.signedUrl ?? null };
}

export async function uploadReceipt(id: string, file: Express.Multer.File, actorId: string, actorRole: string, actorEmployeeId?: string | null) {
  const expense = await getExpense(id, actorRole, actorEmployeeId);
  const storagePath = `${id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .update({ receipt_url: storagePath })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'expense_report', id, `Attached receipt to expense: ${expense.title}`);
  return resolveReceiptUrl(data);
}

const SELECT = `
  id, display_id, employee_id, title, category, amount, currency,
  expense_date, notes, receipt_url, status, reviewed_by, reviewed_at,
  rejection_reason, paid_at, deleted_at, created_at, updated_at,
  employee:employees!employee_id(first_name, last_name, display_id)
`.trim();

export async function listExpenses(query: ListExpensesQuery, viewerRole: string, viewerEmployeeId?: string | null) {
  let q = supabaseAdmin
    .from('expense_reports')
    .select(SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Employees only see their own
  if (viewerRole === 'employee' && viewerEmployeeId) {
    q = q.eq('employee_id', viewerEmployeeId);
  } else if (query.employeeId) {
    q = q.eq('employee_id', query.employeeId);
  }

  if (query.status !== 'all') q = q.eq('status', query.status);

  const offset = (query.page - 1) * query.limit;
  q = q.range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  const resolved = await Promise.all((data ?? []).map(resolveReceiptUrl));
  return { data: resolved, total: count ?? 0 };
}

export async function getExpense(id: string, actorRole?: string, actorEmployeeId?: string | null): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new NotFoundError('Expense not found');
  if (actorRole === 'employee' && (data as any).employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only view your own expenses');
  }
  return resolveReceiptUrl(data);
}

export async function createExpense(input: CreateExpenseInput, employeeId: string, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .insert({
      employee_id:  employeeId,
      title:        input.title,
      category:     input.category,
      amount:       input.amount,
      currency:     input.currency,
      expense_date: input.expenseDate,
      notes:        input.notes ?? null,
      receipt_url:  input.receiptUrl ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'expense_report', row.id, `Created expense: ${row.title}`);
  return resolveReceiptUrl(row);
}

export async function updateExpense(id: string, input: UpdateExpenseInput, actorId: string, actorRole: string, actorEmployeeId?: string | null) {
  const expense = await getExpense(id);
  if (expense.status !== 'draft') throw new ForbiddenError('Only draft expenses can be edited');
  if (actorRole === 'employee' && expense.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only edit your own expenses');
  }

  const patch: Record<string, unknown> = {};
  if (input.title       !== undefined) patch.title        = input.title;
  if (input.category    !== undefined) patch.category     = input.category;
  if (input.amount      !== undefined) patch.amount       = input.amount;
  if (input.currency    !== undefined) patch.currency     = input.currency;
  if (input.expenseDate !== undefined) patch.expense_date = input.expenseDate;
  if (input.notes       !== undefined) patch.notes        = input.notes ?? null;
  if (input.receiptUrl  !== undefined) patch.receipt_url  = input.receiptUrl ?? null;

  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'expense_report', id, `Updated expense: ${expense.title}`);
  return resolveReceiptUrl(data);
}

export async function submitExpense(id: string, actorId: string, actorEmployeeId?: string | null) {
  const expense = await getExpense(id);
  if (expense.status !== 'draft') throw new ForbiddenError('Only draft expenses can be submitted');
  if (actorEmployeeId && expense.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only submit your own expenses');
  }

  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .update({ status: 'submitted' })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');

  void logActivity(actorId, 'status_changed', 'expense_report', id, `Submitted expense: ${expense.title}`);

  // Notify finance + admin + hr
  const adminFinanceIds = await getUserIdsByRole('finance');
  const adminIds = await getUserIdsByRole('admin');
  const hrIds = await getUserIdsByRole('hr');
  const notifyIds = [...new Set([...adminFinanceIds, ...adminIds, ...hrIds])];
  for (const uid of notifyIds) {
    void createNotification(uid, 'New Expense Submitted', `${expense.title} submitted for review`, 'info', 'expense_report', id, '/portal/expenses');
  }

  return data as any;
}

export async function reviewExpense(id: string, input: ReviewExpenseInput, reviewerId: string) {
  const expense = await getExpense(id);
  if (expense.status !== 'submitted') throw new ForbiddenError('Only submitted expenses can be reviewed');

  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .update({
      status:           input.action,
      reviewed_by:      reviewerId,
      reviewed_at:      new Date().toISOString(),
      rejection_reason: input.action === 'rejected' ? (input.rejectionReason ?? null) : null,
    })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');

  void logActivity(reviewerId, 'status_changed', 'expense_report', id, `${input.action} expense: ${expense.title}`);
  bustNavBadgeCache();

  // Notify the employee
  const empUserId = await getPortalUserByEmployeeId(expense.employee_id);
  if (empUserId) {
    const msg = input.action === 'approved'
      ? `Your expense "${expense.title}" was approved`
      : `Your expense "${expense.title}" was rejected${input.rejectionReason ? `: ${input.rejectionReason}` : ''}`;
    void createNotification(empUserId, `Expense ${input.action}`, msg, input.action === 'approved' ? 'success' : 'warning', 'expense_report', id, '/portal/expenses');
  }

  return data as any;
}

export async function markPaid(id: string, actorId: string) {
  const expense = await getExpense(id);
  if (expense.status !== 'approved') throw new ForbiddenError('Only approved expenses can be marked as paid');

  const { data, error } = await supabaseAdmin
    .from('expense_reports')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');

  void logActivity(actorId, 'status_changed', 'expense_report', id, `Marked expense paid: ${expense.title}`);

  // Notify the employee
  const empUserId2 = await getPortalUserByEmployeeId(expense.employee_id);
  if (empUserId2) {
    void createNotification(empUserId2, 'Expense Paid', `Your expense "${expense.title}" has been paid`, 'success', 'expense_report', id, '/portal/expenses');
  }

  return data as any;
}

export async function deleteExpense(id: string, actorId: string, actorRole: string, actorEmployeeId?: string | null) {
  const expense = await getExpense(id);
  if (expense.status !== 'draft') throw new ForbiddenError('Only draft expenses can be deleted');
  if (actorRole === 'employee' && expense.employee_id !== actorEmployeeId) {
    throw new ForbiddenError('You can only delete your own expenses');
  }

  const { error } = await supabaseAdmin
    .from('expense_reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'expense_report', id, `Deleted expense: ${expense.title}`);
}
