import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { createNotification, getUserIdsByRole } from './notifications.service';
import type { CreateTicketInput, ResolveTicketInput, ListTicketsQuery } from '../schemas/supportTicket.schema';

const SELECT = `
  *,
  cases(display_id),
  employees!employee_id(first_name, last_name, display_id),
  created_by_user:portal_users!created_by(name),
  resolved_by_user:portal_users!resolved_by(name)
`;

export async function listTickets(query: ListTicketsQuery, userRole: string, userId: string) {
  let q = supabaseAdmin.from('support_tickets').select(SELECT, { count: 'exact' });

  // HR only ever sees the tickets they personally raised — their own request
  // queue to Legal, not every ticket in the system. Admin/legal see everything.
  if (userRole === 'hr') q = q.eq('created_by', userId);
  if (query.status) q = q.eq('status', query.status);

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getTicket(id: string, userRole: string, userId: string) {
  const { data, error } = await supabaseAdmin.from('support_tickets').select(SELECT).eq('id', id).single();
  if (error || !data) throw new NotFoundError('Support ticket not found');
  if (userRole === 'hr' && data.created_by !== userId) {
    throw new ForbiddenError('You may only view support tickets you created.');
  }
  return data;
}

export async function createTicket(input: CreateTicketInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      case_id: input.caseId,
      employee_id: input.employeeId,
      subject: input.subject,
      message: input.message,
      created_by: actorId,
    })
    .select()
    .single();

  if (error) throw error;
  logActivity(actorId, 'created', 'support_ticket', data.id, data.display_id, {});

  const legalIds = await getUserIdsByRole('legal');
  for (const uid of legalIds) {
    await createNotification(uid, 'New Support Ticket', data.subject, 'info', 'support_ticket', data.id, `/portal/support-tickets/${data.id}`);
  }
  return data;
}

export async function resolveTicket(id: string, input: ResolveTicketInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update({
      status: 'resolved',
      resolution: input.resolution,
      resolved_by: actorId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Support ticket not found');
  logActivity(actorId, 'updated', 'support_ticket', data.id, data.display_id, { event: 'resolved' });

  await createNotification(
    data.created_by,
    'Your Support Ticket Was Resolved',
    data.subject,
    'success',
    'support_ticket',
    data.id,
    `/portal/support-tickets/${data.id}`,
  );
  return data;
}
