import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { createNotification, getPortalUserByEmployeeId } from './notifications.service';
import { assertCaseExists } from './cases.service';
import type { CreateCaseMessageInput } from '../schemas/caseMessage.schema';

// Legal-authored thread on a case (audience: all/law_firm/beneficiary),
// with per-recipient read tracking. Authoring + the legal-side thread view
// stay admin/legal-only (see cases.routes.ts) — the employee never gets a
// case-scoped read endpoint; their visibility into a 'beneficiary'/'all'
// message is entirely via the normal notifications system (see below), the
// minimal-diff way to surface it on their own portal without a parallel
// employee-facing case UI.
export async function listMessages(caseId: string, viewerUserId?: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_messages')
    .select('*, portal_users!author_id(name), case_message_reads(user_id)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    read: viewerUserId ? (m.case_message_reads ?? []).some((r: any) => r.user_id === viewerUserId) : false,
  }));
}

export async function createMessage(caseId: string, input: CreateCaseMessageInput, actorId?: string) {
  const parent = await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_messages')
    .insert({ case_id: caseId, body: input.body, audience: input.audience, author_id: actorId ?? null })
    .select('*, portal_users!author_id(name)')
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case', caseId, parent.display_id, { event: 'case_message_posted' });

  // Employee-visible surfacing: a message addressed to 'beneficiary' or 'all'
  // fans out into the same notifications system the bell icon/Notifications
  // page already render — no case-scoped read access is granted.
  if (input.audience !== 'law_firm') {
    const { data: caseRow } = await supabaseAdmin.from('cases').select('employee_id').eq('id', caseId).maybeSingle();
    if (caseRow?.employee_id) {
      const portalUserId = await getPortalUserByEmployeeId(caseRow.employee_id);
      if (portalUserId) {
        await createNotification(
          portalUserId, 'New message on your case',
          input.body.slice(0, 140),
          'info', 'case', caseId, '/portal/profile',
        );
      }
    }
  }

  return data;
}

export async function markMessageRead(messageId: string, userId: string) {
  const { data: msg } = await supabaseAdmin.from('case_messages').select('id').eq('id', messageId).maybeSingle();
  if (!msg) throw new NotFoundError('Message not found');
  const { error } = await supabaseAdmin
    .from('case_message_reads')
    .upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
}
