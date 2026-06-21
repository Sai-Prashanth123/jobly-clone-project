import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { ConflictError } from '../lib/errors';

const SEL = `id, employee_id, skill_name, proficiency, last_used_year, is_primary, created_at, updated_at, employee:employees!employee_id(id, first_name, last_name, display_id, job_title, department)`;

export async function getEmployeeSkills(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_skills')
    .select(SEL)
    .eq('employee_id', employeeId)
    .order('is_primary', { ascending: false })
    .order('skill_name');
  if (error) throw error;
  return data ?? [];
}

export async function searchSkills(skillName: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_skills')
    .select(SEL)
    .ilike('skill_name', `%${skillName}%`)
    .order('skill_name');
  if (error) throw error;
  return data ?? [];
}

export async function addSkill(employeeId: string, input: { skillName: string; proficiency?: string; lastUsedYear?: number; isPrimary?: boolean }, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('employee_skills')
    .insert({ employee_id: employeeId, skill_name: input.skillName, proficiency: input.proficiency ?? 'intermediate', last_used_year: input.lastUsedYear ?? null, is_primary: input.isPrimary ?? false })
    .select(SEL).single();
  if (error) {
    if ((error as any).code === '23505') throw new ConflictError('Skill already exists for this employee');
    throw error;
  }
  void logActivity(actorId, 'created', 'skill', (data as any).id, `Added skill: ${input.skillName}`);
  return data as any;
}

export async function updateSkill(id: string, input: { proficiency?: string; lastUsedYear?: number; isPrimary?: boolean }, actorId: string) {
  const patch: any = {};
  if (input.proficiency !== undefined) patch.proficiency = input.proficiency;
  if (input.lastUsedYear !== undefined) patch.last_used_year = input.lastUsedYear;
  if (input.isPrimary !== undefined) patch.is_primary = input.isPrimary;
  const { data, error } = await supabaseAdmin.from('employee_skills').update(patch).eq('id', id).select(SEL).single();
  if (error || !data) throw error ?? new Error('Not found');
  void logActivity(actorId, 'updated', 'skill', id, 'Updated skill');
  return data as any;
}

export async function deleteSkill(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('employee_skills').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'skill', id, 'Deleted skill');
}
