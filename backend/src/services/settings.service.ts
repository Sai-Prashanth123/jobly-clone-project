import { supabaseAdmin } from '../config/supabase';

export async function getSettings() {
  const { data, error } = await supabaseAdmin.from('system_settings').select('*').order('key');
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[(row as any).key] = (row as any).value ?? '';
  return out;
}

export async function updateSettings(updates: Record<string, string>, actorId: string) {
  const rows = Object.entries(updates).map(([key, value]) => ({
    key, value, updated_by: actorId, updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  return getSettings();
}
