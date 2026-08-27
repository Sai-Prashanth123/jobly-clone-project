import { supabaseAdmin } from '../config/supabase';

export async function logActivity(
  actorId: string | null,
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'sent' | 'submitted' | 'uploaded_client_proof' | 'removed_client_proof' | 'downloaded_pdf' | 'requested_changes' | 'reopened',
  entityType: 'employee' | 'client' | 'assignment' | 'timesheet' | 'monthly_timesheet' | 'invoice' | 'portal_user' | 'payment' | 'leave_request' | 'announcement' | 'leave_type' | 'leave_entitlement' | 'expense_report' | 'onboarding_template' | 'onboarding_task' | 'asset' | 'performance_review' | 'holiday' | 'system_setting' | 'offboarding_template' | 'offboarding_task' | 'skill' | 'shift' | 'budget' | 'tax_document' | 'enrollment_form' | 'case' | 'case_filing' | 'case_note' | 'support_ticket',
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
  } catch (err) {
    // Activity logging must never break the main flow, but ops needs to see
    // failures so audit-trail gaps don't go unnoticed.
    console.error('[activityLogger] insert failed', { actorId, action, entityType, entityId, entityLabel }, err);
  }
}
