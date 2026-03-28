import { supabaseAdmin } from '../config/supabase';

export async function logActivity(
  actorId: string | null,
  action: 'created' | 'updated' | 'deleted' | 'status_changed',
  entityType: 'employee' | 'client' | 'assignment' | 'timesheet' | 'invoice',
  entityId: string,
  entityLabel: string,
  metadata?: object,
) {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      metadata: metadata ?? null,
    });
  } catch (_) {
    // Activity logging must never break the main flow
  }
}
