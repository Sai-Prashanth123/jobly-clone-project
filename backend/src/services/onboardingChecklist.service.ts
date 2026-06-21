import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError } from '../lib/errors';
import type { CreateTemplateInput, UpdateTemplateInput, AddCustomTaskInput } from '../schemas/onboardingChecklist.schema';

// ── Templates ──────────────────────────────────────────────────────────────────

export async function listTemplates(activeOnly = false) {
  let q = supabaseAdmin
    .from('onboarding_checklist_templates')
    .select('*')
    .order('sort_order')
    .order('title');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTemplate(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('onboarding_checklist_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new NotFoundError('Template not found');
  return data as any;
}

export async function createTemplate(input: CreateTemplateInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('onboarding_checklist_templates')
    .insert({
      title:       input.title,
      description: input.description ?? null,
      category:    input.category,
      is_required: input.isRequired,
      sort_order:  input.sortOrder,
      is_active:   input.isActive,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'onboarding_template', row.id, `Created checklist template: ${row.title}`);
  return row;
}

export async function updateTemplate(id: string, input: UpdateTemplateInput, actorId: string) {
  await getTemplate(id);
  const patch: Record<string, unknown> = {};
  if (input.title       !== undefined) patch.title       = input.title;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.category    !== undefined) patch.category    = input.category;
  if (input.isRequired  !== undefined) patch.is_required = input.isRequired;
  if (input.sortOrder   !== undefined) patch.sort_order  = input.sortOrder;
  if (input.isActive    !== undefined) patch.is_active   = input.isActive;

  const { data, error } = await supabaseAdmin
    .from('onboarding_checklist_templates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'onboarding_template', id, `Updated checklist template`);
  return data as any;
}

export async function deleteTemplate(id: string, actorId: string) {
  const t = await getTemplate(id);
  const { error } = await supabaseAdmin
    .from('onboarding_checklist_templates')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'onboarding_template', id, `Deactivated checklist template: ${t.title}`);
}

// ── Employee Tasks ──────────────────────────────────────────────────────────────

export async function getEmployeeTasks(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_onboarding_tasks')
    .select('*, completed_by_user:portal_users!completed_by(name)')
    .eq('employee_id', employeeId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addCustomTask(employeeId: string, input: AddCustomTaskInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_onboarding_tasks')
    .insert({
      employee_id:  employeeId,
      title:        input.title,
      description:  input.description ?? null,
      category:     input.category,
      is_required:  input.isRequired,
      notes:        input.notes ?? null,
      due_date:     input.dueDate ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'onboarding_task', row.id, `Added custom task: ${row.title}`);
  return row;
}

export async function toggleTask(taskId: string, actorId: string) {
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('employee_onboarding_tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (fetchErr || !existing) throw new NotFoundError('Task not found');

  const nowComplete = !(existing as any).is_completed;
  const { data, error } = await supabaseAdmin
    .from('employee_onboarding_tasks')
    .update({
      is_completed: nowComplete,
      completed_by: nowComplete ? actorId : null,
      completed_at: nowComplete ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'onboarding_task', taskId, `${nowComplete ? 'Completed' : 'Uncompleted'} task: ${(existing as any).title}`);
  return data as any;
}

// Called from employees.service.ts createEmployee — bulk-copies active templates
export async function generateTasksForEmployee(employeeId: string) {
  const templates = await listTemplates(true);
  if (templates.length === 0) return;

  const tasks = (templates as any[]).map(t => ({
    employee_id:  employeeId,
    template_id:  t.id,
    title:        t.title,
    description:  t.description ?? null,
    category:     t.category,
    is_required:  t.is_required,
    sort_order:   t.sort_order,
  }));

  const { error } = await supabaseAdmin.from('employee_onboarding_tasks').insert(tasks);
  if (error) console.error('[onboardingChecklist] generateTasksForEmployee failed', error);
}
