import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { sanitizeForPostgrestFilter } from '../lib/postgrestSanitize';
import * as storageSvc from './storage.service';
import { isValidCaseDocumentCategory } from '../lib/caseDocumentCategories';
import type { UpsertWageInput, UpsertTaxReturnInput } from '../schemas/caseWages.schema';
import type { UpsertPermDetailsInput } from '../schemas/casePerm.schema';
import { CASE_STATUS_STEPS, isValidCaseStatusStepKey } from '../lib/caseStatusSteps';
import type {
  CreateCaseInput, UpdateCaseInput, ListCasesQuery,
  CreateFilingInput, UpdateFilingInput, CreateNoteInput,
} from '../schemas/case.schema';

// Kept in sync with LEGAL_ALLOWED_EMPLOYEE_FIELDS in employees.service.ts —
// the only other place employee PII crosses into a `legal`-role view. Any
// field added to one must be deliberately added to the other, never just one.
const EMPLOYEE_EMBED = 'employees!employee_id(id, first_name, last_name, middle_name, display_id, email, status, nationality, visa_type, visa_expiry, i9_status, e_verify_status, e_verify_case_number, dependents, profile_photo_url, dob, gender, marital_status, preferred_language, languages_known, phone, alt_phone, address_street, address_city, address_state, address_zip, address_country, permanent_address_street, permanent_address_city, permanent_address_state, permanent_address_zip, permanent_address_country, department, job_title, employment_type, start_date, work_location, education, work_history, total_experience_years, experience_level, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_alt_phone, emergency_contact_address, emergency_contact_city, emergency_contact_state, emergency_contact_zip)';
const PETITIONER_EMBED = 'petitioners!petitioner_id(id, name, ein_fein)';
const DETAIL_SELECT = `*, ${EMPLOYEE_EMBED}, ${PETITIONER_EMBED}, case_filings(*), case_notes(*, portal_users!author_id(name), tagged_to_user:portal_users!tagged_to(name)), case_status_steps(*)`;

// Minimal directory for the Notes "Tagged To" picker — legal can't reach
// /admin/users (admin-only), so this is a narrow, purpose-built substitute
// scoped to just the roles relevant to case work.
export async function listTaggableUsers() {
  const { data, error } = await supabaseAdmin
    .from('portal_users').select('id, name, role').in('role', ['admin', 'legal']).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listCases(query: ListCasesQuery) {
  let q = supabaseAdmin
    .from('cases')
    .select(`*, ${EMPLOYEE_EMBED}, ${PETITIONER_EMBED}`, { count: 'exact' })
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
  const record = data as unknown as {
    employee_id: string;
    case_filings?: { deleted_at: string | null }[];
    case_notes?: { deleted_at: string | null }[];
    case_status_steps?: { step_order: number }[];
  };

  // The employee's own already-uploaded documents (onboarding/identity docs
  // like I-797, passport, questionnaires) live in the SAME `documents` table
  // as case documents but under entity_type='employee' — a completely
  // separate, non-overlapping set from this case's own entity_type='case'
  // documents. EMPLOYEE_EMBED above only pulls plain `employees` columns
  // (documents is a separate table, not a column), so without this explicit
  // second query legal has no way to see documents already on file for the
  // employee this case is about — read-only here, uploads/edits still only
  // happen from the employee's own record.
  const { data: employeeDocuments } = await supabaseAdmin
    .from('documents')
    .select('*, portal_users!uploaded_by(name, role)')
    .eq('entity_type', 'employee')
    .eq('entity_id', record.employee_id)
    .order('uploaded_at', { ascending: false });

  return {
    ...data,
    case_filings: (record.case_filings ?? []).filter(f => !f.deleted_at),
    case_notes: (record.case_notes ?? []).filter(n => !n.deleted_at),
    // PostgREST embeds don't guarantee order without an explicit hint on the
    // embedded resource — sort here instead.
    case_status_steps: [...(record.case_status_steps ?? [])].sort((a, b) => a.step_order - b.step_order),
    employee_documents: employeeDocuments ?? [],
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
      petitioner_id: input.petitionerId,
      classification: input.classification,
      created_by: actorId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case', data.id, data.display_id, {});

  // Seed the 11 fixed status-timeline steps (all uncompleted) — additive to
  // the coarse `status` column above, not a replacement for it.
  await supabaseAdmin.from('case_status_steps').insert(
    CASE_STATUS_STEPS.map(s => ({ case_id: data.id, step_key: s.key, step_order: s.order })),
  );

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
  if (input.petitionerId !== undefined) updateData.petitioner_id = input.petitionerId;
  if (input.classification !== undefined) updateData.classification = input.classification;

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

export async function assertCaseExists(caseId: string) {
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

const NOTE_SELECT = '*, portal_users!author_id(name), tagged_to_user:portal_users!tagged_to(name)';

export async function createNote(caseId: string, input: CreateNoteInput, actorId?: string) {
  const parent = await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_notes')
    .insert({
      case_id: caseId, body: input.body, author_id: actorId ?? null,
      title: input.title, tagged_to: input.taggedTo, status: input.status, access_level: input.accessLevel,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'case_note', data.id, parent.display_id, {});
  return data;
}

export async function updateNote(caseId: string, noteId: string, input: CreateNoteInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('case_notes')
    .update({
      body: input.body, edited_at: new Date().toISOString(),
      title: input.title, tagged_to: input.taggedTo, status: input.status, access_level: input.accessLevel,
    })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select(NOTE_SELECT)
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

// ── Case Documents ──────────────────────────────────────────────────────────
// Reuses the existing polymorphic documents table (entity_type='case') rather
// than a dedicated table — every upload/signed-URL/delete code path in
// storage.service.ts already works generically off entity_type/entity_id.
// `uploaded_by` is joined to portal_users here (no other document read path in
// the app does this) so the UI can show "Uploaded By X (role)" attribution.
export async function listCaseDocuments(caseId: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*, portal_users!uploaded_by(name, role)')
    .eq('entity_type', 'case')
    .eq('entity_id', caseId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadCaseDocument(
  caseId: string,
  file: Express.Multer.File,
  category: string,
  uploadedBy: string,
) {
  await assertCaseExists(caseId);
  if (!isValidCaseDocumentCategory(category)) {
    throw new ValidationError('Invalid document category');
  }
  const doc = await storageSvc.uploadDocument('case', caseId, file, uploadedBy, undefined, category, null, category);
  logActivity(uploadedBy, 'created', 'case_document', doc.id, caseId, { category });
  return doc;
}

export async function removeCaseDocument(caseId: string, docId: string, actorId?: string) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents').select('id, entity_type, entity_id').eq('id', docId).single();
  if (error || !doc || doc.entity_type !== 'case' || doc.entity_id !== caseId) {
    throw new NotFoundError('Document not found on this case');
  }
  await storageSvc.deleteDocument(docId);
  logActivity(actorId ?? null, 'deleted', 'case_document', docId, caseId, {});
}

// ── Wages as per W2 / Tax Returns ────────────────────────────────────────────
// Manual entry by Legal — simple per-year tables, matching the reference
// screenshots (a year-by-year list, mostly blank until Legal fills it in).

export async function listWages(caseId: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_wages').select('*').eq('case_id', caseId).order('wage_year', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertWage(caseId: string, input: UpsertWageInput, actorId?: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_wages')
    .upsert(
      { case_id: caseId, wage_year: input.wageYear, salary_received: input.salaryReceived ?? null, document_id: input.documentId ?? null },
      { onConflict: 'case_id,wage_year' },
    )
    .select()
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'case', caseId, String(input.wageYear), { event: 'wage_upserted' });
  return data;
}

export async function listTaxReturns(caseId: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_tax_returns').select('*').eq('case_id', caseId).order('tax_year', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertTaxReturn(caseId: string, input: UpsertTaxReturnInput, actorId?: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_tax_returns')
    .upsert(
      { case_id: caseId, tax_year: input.taxYear, amount: input.amount ?? null, document_id: input.documentId ?? null },
      { onConflict: 'case_id,tax_year' },
    )
    .select()
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'case', caseId, String(input.taxYear), { event: 'tax_return_upserted' });
  return data;
}

// ── PERM ─────────────────────────────────────────────────────────────────────
// One row per case, upserted as Legal fills in job details — null/absent
// until then.

export async function getPermDetails(caseId: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_perm_details').select('*').eq('case_id', caseId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertPermDetails(caseId: string, input: UpsertPermDetailsInput, actorId?: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_perm_details')
    .upsert(
      {
        case_id: caseId,
        job_title: input.jobTitle ?? null,
        full_time_position: input.fullTimePosition ?? null,
        work_hours_per_week: input.workHoursPerWeek ?? null,
        wage_rate: input.wageRate ?? null,
        soc_code: input.socCode ?? null,
        pay_frequency: input.payFrequency ?? null,
        classification: input.classification ?? null,
        permanent_position: input.permanentPosition ?? null,
        experience_required: input.experienceRequired ?? null,
        months_of_experience: input.monthsOfExperience ?? null,
        work_address: input.workAddress ?? null,
        minimum_education: input.minimumEducation ?? null,
        major_field_of_study: input.majorFieldOfStudy ?? null,
      },
      { onConflict: 'case_id' },
    )
    .select()
    .single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'case', caseId, 'PERM', { event: 'perm_details_upserted' });
  return data;
}

// ── Status Timeline ──────────────────────────────────────────────────────────
// Additive to the coarse `case_status` enum, not derived from/into it —
// deliberately kept independent (see caseStatusSteps.ts).

export async function listStatusSteps(caseId: string) {
  await assertCaseExists(caseId);
  const { data, error } = await supabaseAdmin
    .from('case_status_steps').select('*').eq('case_id', caseId).order('step_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Idempotent — completing an already-completed step is a no-op, not an error.
export async function completeStatusStep(caseId: string, stepKey: string, actorId?: string) {
  await assertCaseExists(caseId);
  if (!isValidCaseStatusStepKey(stepKey)) throw new ValidationError('Invalid status step');
  const { data, error } = await supabaseAdmin
    .from('case_status_steps')
    .update({ completed_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .eq('step_key', stepKey)
    .is('completed_at', null)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) logActivity(actorId ?? null, 'updated', 'case', caseId, stepKey, { event: 'status_step_completed' });
  return data ?? { case_id: caseId, step_key: stepKey };
}
