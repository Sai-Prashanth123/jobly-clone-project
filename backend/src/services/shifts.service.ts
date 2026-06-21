import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError } from '../lib/errors';

const SEL = `id, employee_id, date, start_time, end_time, shift_type, notes, created_by, created_at, updated_at, employee:employees!employee_id(id, first_name, last_name, display_id, department)`;

export async function listShifts(params: { startDate?: string; endDate?: string; employeeId?: string; department?: string }) {
  let q = supabaseAdmin.from('shifts').select(SEL).order('date').order('start_time');
  if (params.startDate) q = q.gte('date', params.startDate);
  if (params.endDate) q = q.lte('date', params.endDate);
  if (params.employeeId) q = q.eq('employee_id', params.employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createShift(input: { employeeId: string; date: string; startTime: string; endTime: string; shiftType?: string; notes?: string }, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .insert({ employee_id: input.employeeId, date: input.date, start_time: input.startTime, end_time: input.endTime, shift_type: input.shiftType ?? 'morning', notes: input.notes ?? null, created_by: actorId })
    .select(SEL).single();
  if (error || !data) throw error ?? new Error('Insert failed');
  void logActivity(actorId, 'created', 'shift', (data as any).id, `Shift on ${input.date}`);
  return data as any;
}

export async function updateShift(id: string, input: { date?: string; startTime?: string; endTime?: string; shiftType?: string; notes?: string }, actorId: string) {
  const patch: any = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.startTime !== undefined) patch.start_time = input.startTime;
  if (input.endTime !== undefined) patch.end_time = input.endTime;
  if (input.shiftType !== undefined) patch.shift_type = input.shiftType;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  const { data, error } = await supabaseAdmin.from('shifts').update(patch).eq('id', id).select(SEL).single();
  if (error || !data) throw new NotFoundError('Shift not found');
  void logActivity(actorId, 'updated', 'shift', id, 'Updated shift');
  return data as any;
}

export async function deleteShift(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('shifts').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'shift', id, 'Deleted shift');
}
