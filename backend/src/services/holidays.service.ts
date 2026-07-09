import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';

// A recurring holiday (is_recurring=true) is stored under the year it was
// first added, but should be recognized every year — remap its month-day
// onto whichever year is being queried rather than requiring it to be
// re-added annually. This only produces a correct date for FIXED-date
// holidays (e.g. Jan 1, Jul 4, Dec 25) — floating holidays ("3rd Monday of
// January") fall on a different day each year and must NOT be marked
// recurring; add a fresh dated entry for each year instead. If a
// non-recurring entry with the same name already exists for the queried
// year, it overrides the remap (lets a specific year's manual entry win,
// e.g. an observed-day shift or a corrected floating-holiday date).
export async function listHolidays(year?: number) {
  if (!year) {
    const { data, error } = await supabaseAdmin.from('company_holidays').select('*').order('date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  const [nonRecurring, recurring] = await Promise.all([
    supabaseAdmin.from('company_holidays').select('*')
      .eq('is_recurring', false)
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
    supabaseAdmin.from('company_holidays').select('*').eq('is_recurring', true),
  ]);
  if (nonRecurring.error) throw nonRecurring.error;
  if (recurring.error) throw recurring.error;

  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  const remapped = (recurring.data ?? [])
    .map(row => {
      const monthDay = row.date.slice(5); // 'MM-DD'
      if (monthDay === '02-29' && !isLeapYear(year)) return null; // no Feb 29 this year
      return { ...row, date: `${year}-${monthDay}` };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    // A manually-entered holiday already covers this exact year under the same
    // name — it overrides the remap (e.g. a fixed-date holiday observed on a
    // different weekday because its calendar date landed on a weekend, or a
    // floating holiday whose "Nth weekday of month" date isn't the same as
    // last year's and was corrected by hand for this year).
    .filter(row => !(nonRecurring.data ?? []).some(nr => sameName(nr.name, row.name)));

  return [...(nonRecurring.data ?? []), ...remapped].sort((a, b) => a.date.localeCompare(b.date));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export async function createHoliday(input: { name: string; date: string; isRecurring?: boolean; countryCode?: string }, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('company_holidays')
    .insert({ name: input.name, date: input.date, is_recurring: input.isRecurring ?? false, country_code: input.countryCode ?? 'US' })
    .select().single();
  if (error || !data) throw error ?? new Error('Insert failed');
  void logActivity(actorId, 'created', 'holiday', (data as any).id, `Holiday: ${input.name}`);
  return data as any;
}

export async function updateHoliday(id: string, input: { name?: string; date?: string; isRecurring?: boolean; countryCode?: string }, actorId: string) {
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.date !== undefined) patch.date = input.date;
  if (input.isRecurring !== undefined) patch.is_recurring = input.isRecurring;
  if (input.countryCode !== undefined) patch.country_code = input.countryCode;
  const { data, error } = await supabaseAdmin.from('company_holidays').update(patch).eq('id', id).select().single();
  if (error || !data) throw new NotFoundError('Holiday not found');
  void logActivity(actorId, 'updated', 'holiday', id, `Updated holiday`);
  return data as any;
}

export async function deleteHoliday(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('company_holidays').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'holiday', id, 'Deleted holiday');
}
