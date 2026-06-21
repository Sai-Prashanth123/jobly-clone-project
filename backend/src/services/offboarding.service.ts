import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';

export async function listTemplates() {
  const { data, error } = await supabaseAdmin
    .from('offboarding_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(input: any, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('offboarding_templates')
    .insert({ title: input.title, description: input.description ?? null, category: input.category ?? 'general', is_required: input.isRequired ?? true, sort_order: input.sortOrder ?? 0 })
    .select().single();
  if (error || !data) throw error ?? new Error('Insert failed');
  void logActivity(actorId, 'created', 'offboarding_template', (data as any).id, `Offboarding template: ${input.title}`);
  return data as any;
}

export async function updateTemplate(id: string, input: any, actorId: string) {
  const patch: any = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.isRequired !== undefined) patch.is_required = input.isRequired;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { data, error } = await supabaseAdmin.from('offboarding_templates').update(patch).eq('id', id).select().single();
  if (error || !data) throw error ?? new Error('Not found');
  void logActivity(actorId, 'updated', 'offboarding_template', id, 'Updated offboarding template');
  return data as any;
}

export async function deleteTemplate(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('offboarding_templates').update({ is_active: false }).eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'offboarding_template', id, 'Deactivated offboarding template');
}

export async function getEmployeeTasks(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('offboarding_tasks')
    .select(`*, completed_by_user:portal_users!completed_by(name)`)
    .eq('employee_id', employeeId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function generateTasksForEmployee(employeeId: string, actorId: string) {
  const templates = await listTemplates();
  if (templates.length === 0) return;
  const rows = templates.map((t: any) => ({
    employee_id: employeeId, template_id: t.id, title: t.title,
    description: t.description, category: t.category,
    is_required: t.is_required, sort_order: t.sort_order,
  }));
  const { error } = await supabaseAdmin.from('offboarding_tasks').insert(rows);
  if (error) throw error;
  void logActivity(actorId, 'created', 'offboarding_task', employeeId, `Generated ${rows.length} offboarding tasks`);
}

export async function addTask(employeeId: string, input: any, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('offboarding_tasks')
    .insert({ employee_id: employeeId, title: input.title, description: input.description ?? null, category: input.category ?? 'general', is_required: input.isRequired ?? true, notes: input.notes ?? null, due_date: input.dueDate ?? null, sort_order: input.sortOrder ?? 0 })
    .select().single();
  if (error || !data) throw error ?? new Error('Insert failed');
  void logActivity(actorId, 'created', 'offboarding_task', (data as any).id, `Added offboarding task: ${input.title}`);
  return data as any;
}

export async function toggleTask(taskId: string, actorId: string) {
  const { data: existing } = await supabaseAdmin.from('offboarding_tasks').select('is_completed').eq('id', taskId).single();
  const nowCompleted = !((existing as any)?.is_completed ?? false);
  const patch: any = {
    is_completed: nowCompleted,
    completed_by: nowCompleted ? actorId : null,
    completed_at: nowCompleted ? new Date().toISOString() : null,
  };
  const { data, error } = await supabaseAdmin.from('offboarding_tasks').update(patch).eq('id', taskId).select().single();
  if (error || !data) throw error ?? new Error('Not found');
  void logActivity(actorId, 'updated', 'offboarding_task', taskId, `${nowCompleted ? 'Completed' : 'Reopened'} offboarding task`);
  return data as any;
}
