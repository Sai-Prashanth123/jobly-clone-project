import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { NotFoundError } from '../lib/errors';

const SEL = `id, employee_id, tax_year, document_type, file_url, notes, generated_at, sent_at, created_by, created_at, updated_at, employee:employees!employee_id(id, first_name, last_name, display_id)`;

export async function listTaxDocuments(params: { employeeId?: string; taxYear?: number }) {
  let q = supabaseAdmin.from('tax_documents').select(SEL).order('tax_year', { ascending: false }).order('created_at', { ascending: false });
  if (params.employeeId) q = q.eq('employee_id', params.employeeId);
  if (params.taxYear) q = q.eq('tax_year', params.taxYear);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createTaxDocument(input: { employeeId: string; taxYear: number; documentType: string; fileUrl?: string; notes?: string }, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('tax_documents')
    .insert({ employee_id: input.employeeId, tax_year: input.taxYear, document_type: input.documentType, file_url: input.fileUrl ?? null, notes: input.notes ?? null, generated_at: new Date().toISOString(), created_by: actorId })
    .select(SEL).single();
  if (error || !data) throw error ?? new Error('Insert failed');
  void logActivity(actorId, 'created', 'tax_document', (data as any).id, `Tax doc ${input.documentType} ${input.taxYear}`);
  return data as any;
}

export async function updateTaxDocument(id: string, input: { fileUrl?: string; notes?: string; sentAt?: string }, actorId: string) {
  const patch: any = {};
  if (input.fileUrl !== undefined) patch.file_url = input.fileUrl ?? null;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.sentAt !== undefined) patch.sent_at = input.sentAt;
  const { data, error } = await supabaseAdmin.from('tax_documents').update(patch).eq('id', id).select(SEL).single();
  if (error || !data) throw new NotFoundError('Tax document not found');
  void logActivity(actorId, 'updated', 'tax_document', id, 'Updated tax document');
  return data as any;
}

export async function deleteTaxDocument(id: string, actorId: string) {
  const { error } = await supabaseAdmin.from('tax_documents').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'tax_document', id, 'Deleted tax document');
}
