import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sanitizeForPostgrestFilter } from '../lib/postgrestSanitize';
import type {
  CreateCaseInput, UpdateCaseInput, ListCasesQuery,
  CreateFilingInput, UpdateFilingInput, CreateNoteInput,
} from '../schemas/case.schema';

const EMPLOYEE_EMBED = 'employees!employee_id(id, first_name, last_name, display_id, visa_type, visa_expiry, i9_status, e_verify_status, e_verify_case_number)';
const DETAIL_SELECT = `*, ${EMPLOYEE_EMBED}, case_filings(*), case_notes(*, portal_users!author_id(name))`;

export async function listCases(query: ListCasesQuery) {
  let q = supabaseAdmin
    .from('cases')
    .select(`*, ${EMPLOYEE_EMBED}`, { count: 'exact' })
    .is('deleted_at', null);

  if (query.status) q = q.eq('status', query.status);
  if (query.caseType) q = q.eq('case_type', query.caseType);
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.search) {
    const s = sanitizeForPostgrestFilter(query.search);
    q = q.or(`display_id.ilike.%${s}%,receipt_number.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getCase(id: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new NotFoundError('Case not found');

  // Soft-deleted filings/notes ride along in the embed (PostgREST embeds don't
  // support mid-embed .is('deleted_at', null)) — filter them out here.
  const record = data as unknown as { case_filings?: { deleted_at: string | null }[]; case_notes?: { deleted_at: string | null }[] };
  return {
    ...data,
    case_filings: (record.case_filings ?? []).filter(f => !f.deleted_at),
    case_notes: (record.case_notes ?? []).filter(n => !n.deleted_at),
  };
}

export async function createCase(input: CreateCaseInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert({
      employee_id: input.employeeId,
      case_type: input.caseType,
      status: input.status,
      receipt_number: input.receiptNumber,
      priority_date: input.priorityDate,
      filed_date: input.filedDate,
      decision_date: input.decisionDate,
      attorney_name: input.attorneyName,
      description: input.description,
      created_by: actorId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case', data.id, data.display_id, {});
  return data;
}

export async function updateCase(id: string, input: UpdateCaseInput, actorId?: string) {
  const updateData: Record<string, unknown> = {};
  if (input.caseType !== undefined) updateData.case_type = input.caseType;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.receiptNumber !== undefined) updateData.receipt_number = input.receiptNumber;
  if (input.priorityDate !== undefined) updateData.priority_date = input.priorityDate;
  if (input.filedDate !== undefined) updateData.filed_date = input.filedDate;
  if (input.decisionDate !== undefined) updateData.decision_date = input.decisionDate;
  if (input.attorneyName !== undefined) updateData.attorney_name = input.attorneyName;
  if (input.description !== undefined) updateData.description = input.description;

  const { data, error } = await supabaseAdmin
    .from('cases')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Case not found');
  logActivity(actorId ?? null, 'updated', 'case', data.id, data.display_id, {});
  return data;
}

export async function deleteCase(id: string, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, display_id')
    .single();

  if (error || !data) throw new NotFoundError('Case not found');
  logActivity(actorId ?? null, 'deleted', 'case', data.id, data.display_id, {});
}

async function assertCaseExists(caseId: string) {
  const { data } = await supabaseAdmin.from('cases').select('id, display_id').eq('id', caseId).is('deleted_at', null).maybeSingle();
  if (!data) throw new NotFoundError('Case not found');
  return data;
}

export async function createFiling(caseId: string, input: CreateFilingInput, actorId?: string) {
  const parent = await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_filings')
    .insert({
      case_id: caseId,
      filing_type: input.filingType,
      status: input.status,
      reference_number: input.referenceNumber,
      filed_date: input.filedDate,
      decision_date: input.decisionDate,
      details: input.details,
      notes: input.notes,
      created_by: actorId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case_filing', data.id, `${parent.display_id} / ${data.display_id}`, {});
  return data;
}

export async function updateFiling(caseId: string, filingId: string, input: UpdateFilingInput, actorId?: string) {
  const updateData: Record<string, unknown> = {};
  if (input.filingType !== undefined) updateData.filing_type = input.filingType;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.referenceNumber !== undefined) updateData.reference_number = input.referenceNumber;
  if (input.filedDate !== undefined) updateData.filed_date = input.filedDate;
  if (input.decisionDate !== undefined) updateData.decision_date = input.decisionDate;
  if (input.details !== undefined) updateData.details = input.details;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const { data, error } = await supabaseAdmin
    .from('case_filings')
    .update(updateData)
    .eq('id', filingId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Filing not found');
  logActivity(actorId ?? null, 'updated', 'case_filing', data.id, data.display_id, {});
  return data;
}

export async function removeFiling(caseId: string, filingId: string, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('case_filings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', filingId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id, display_id')
    .single();

  if (error || !data) throw new NotFoundError('Filing not found');
  logActivity(actorId ?? null, 'deleted', 'case_filing', data.id, data.display_id, {});
}

export async function createNote(caseId: string, input: CreateNoteInput, actorId?: string) {
  const parent = await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_notes')
    .insert({ case_id: caseId, body: input.body, author_id: actorId ?? null })
    .select('*, portal_users!author_id(name)')
    .single();

  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case_note', data.id, parent.display_id, {});
  return data;
}

export async function updateNote(caseId: string, noteId: string, input: CreateNoteInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('case_notes')
    .update({ body: input.body, edited_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('*, portal_users!author_id(name)')
    .single();

  if (error || !data) throw new NotFoundError('Note not found');
  logActivity(actorId ?? null, 'updated', 'case_note', data.id, caseId, {});
  return data;
}

export async function removeNote(caseId: string, noteId: string, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('case_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !data) throw new NotFoundError('Note not found');
  logActivity(actorId ?? null, 'deleted', 'case_note', data.id, caseId, {});
}
