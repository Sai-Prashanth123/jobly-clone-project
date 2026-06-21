import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { ConflictError } from '../lib/errors';

export async function listBudgets(fiscalYear?: number) {
  let q = supabaseAdmin.from('department_budgets').select('*').order('department').order('budget_type');
  if (fiscalYear) q = q.eq('fiscal_year', fiscalYear);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertBudget(input: { department: string; fiscalYear: number; budgetType: string; budgetAmount: number; notes?: string }, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('department_budgets')
    .upsert({
      department: input.department, fiscal_year: input.fiscalYear,
      budget_type: input.budgetType, budget_amount: input.budgetAmount,
      notes: input.notes ?? null, created_by: actorId,
    }, { onConflict: 'department,fiscal_year,budget_type' })
    .select().single();
  if (error || !data) throw error ?? new Error('Upsert failed');
  void logActivity(actorId, 'updated', 'budget', (data as any).id, `Budget for ${input.department} ${input.fiscalYear}`);
  return data as any;
}

export async function deleteBudget(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('department_budgets').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'budget', id, 'Deleted budget');
}

export async function getBudgetSummary(fiscalYear: number) {
  const [budgets, expenses] = await Promise.all([
    supabaseAdmin.from('department_budgets').select('*').eq('fiscal_year', fiscalYear),
    supabaseAdmin.from('expense_reports').select('amount, status').neq('status', 'rejected').neq('status', 'draft'),
  ]);
  return { budgets: budgets.data ?? [], expenseSummary: expenses.data ?? [] };
}
