import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { createNotification, getPortalUserByEmployeeId, getUserIdsByRole } from './notifications.service';
import { assertCaseExists } from './cases.service';
import type { CreateCaseMessageInput } from '../schemas/caseMessage.schema';

export interface MessageViewer {
  id: string;
  role: string;
  employeeId?: string;
}

// Legal-authored thread on a case (audience: all/law_firm/beneficiary), with
// per-recipient read tracking. Legal/admin/hr use the full thread (Case
// Detail's Messages tab) via CaseMessagesThread.tsx. An employee can also
// read and reply on their OWN case only, via a dedicated portal page
// (src/portal/pages/CaseMessages.tsx, reached from the "new message"
// notification) — enforced below by comparing the case's employee_id against
// the viewer's employeeId, the same ownership pattern used for the
// employee_documents embed in cases.service.ts's getCase().
function assertCanAccessCase(viewer: MessageViewer, caseEmployeeId: string | null): void {
  if (viewer.role === 'employee' && caseEmployeeId !== viewer.employeeId) {
    throw new ForbiddenError('You may only access messages on your own case');
  }
}

export async function listMessages(caseId: string, viewer: MessageViewer) {
  const parent = await assertCaseExists(caseId);
  assertCanAccessCase(viewer, parent.employee_id);

  const { data, error } = await supabaseAdmin
    .from('case_messages')
    .select('*, portal_users!author_id(name), case_message_reads(user_id)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((m: any) => ({
    ...m,
    read: (m.case_message_reads ?? []).some((r: any) => r.user_id === viewer.id),
  })) as { audience: string; author_id: string | null }[];

  // 'law_firm' is the internal admin/hr/legal thread — an employee only sees
  // messages addressed to them ('all'/'beneficiary') plus their own replies
  // (which are always stored as 'law_firm', see createMessage below), never
  // the internal team's other case chatter.
  if (viewer.role === 'employee') {
    return rows.filter(m => m.audience !== 'law_firm' || m.author_id === viewer.id);
  }
  return rows;
}

export async function createMessage(caseId: string, input: CreateCaseMessageInput, actor: MessageViewer) {
  const parent = await assertCaseExists(caseId);
  assertCanAccessCase(actor, parent.employee_id);

  // An employee's own message is always a reply to the case-handling team —
  // there's no "audience" concept from their side, so ignore whatever the
  // client sent and force it server-side.
  const audience = actor.role === 'employee' ? 'law_firm' : input.audience;

  const { data, error } = await supabaseAdmin
    .from('case_messages')
    .insert({ case_id: caseId, body: input.body, audience, author_id: actor.id })
    .select('*, portal_users!author_id(name)')
    .single();
  if (error) throw error;
  logActivity(actor.id, 'created', 'case', caseId, parent.display_id, { event: 'case_message_posted' });

  if (actor.role === 'employee') {
    // Notify the case-handling team a reply came in, on their existing
    // case-detail Messages tab — not the employee's own page (that would
    // notify them about their own message).
    const [hrIds, adminIds, legalIds] = await Promise.all([
      getUserIdsByRole('hr'), getUserIdsByRole('admin'), getUserIdsByRole('legal'),
    ]);
    await Promise.all(
      [...new Set([...hrIds, ...adminIds, ...legalIds])].map(uid =>
        createNotification(uid, 'New reply on case ' + parent.display_id, input.body.slice(0, 140), 'info', 'case', caseId, `/portal/cases/${caseId}`),
      ),
    );
  } else {
    // Staff-authored message. 'law_firm'/'all' notify the OTHER staff
    // (admin/hr/legal, excluding the author) — this was previously missing
    // entirely, so an internal message from Legal never reached Admin/HR at
    // all. Link to the case detail page they already have access to, not the
    // employee-only /portal/case-messages/:caseId link used below.
    if (audience === 'law_firm' || audience === 'all') {
      const [hrIds, adminIds, legalIds] = await Promise.all([
        getUserIdsByRole('hr'), getUserIdsByRole('admin'), getUserIdsByRole('legal'),
      ]);
      const staffIds = [...new Set([...hrIds, ...adminIds, ...legalIds])].filter(uid => uid !== actor.id);
      await Promise.all(
        staffIds.map(uid =>
          createNotification(uid, 'New message on case ' + parent.display_id, input.body.slice(0, 140), 'info', 'case', caseId, `/portal/cases/${caseId}`),
        ),
      );
    }
    // 'beneficiary'/'all' also notify the employee — surfaced via the normal
    // notifications system, linking to the employee's own case-messages page
    // (not their profile — there's nothing case-related there).
    if ((audience === 'beneficiary' || audience === 'all') && parent.employee_id) {
      const portalUserId = await getPortalUserByEmployeeId(parent.employee_id);
      if (portalUserId) {
        await createNotification(
          portalUserId, 'New message on your case',
          input.body.slice(0, 140),
          'info', 'case', caseId, `/portal/case-messages/${caseId}`,
        );
      }
    }
  }

  return data;
}

export async function markMessageRead(messageId: string, viewer: MessageViewer) {
  const { data: msg } = await supabaseAdmin.from('case_messages').select('id, case_id').eq('id', messageId).maybeSingle();
  if (!msg) throw new NotFoundError('Message not found');
  const parent = await assertCaseExists(msg.case_id);
  assertCanAccessCase(viewer, parent.employee_id);

  const { error } = await supabaseAdmin
    .from('case_message_reads')
    .upsert({ message_id: messageId, user_id: viewer.id }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
}
