import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { createNotification, getUserIdsByRole } from './notifications.service';
import { generateEnrollmentFormPDF, type EnrollmentFormPDFData } from '../lib/pdfGenerator';
import type {
  CreateEnrollmentFormInput, UpdateEnrollmentFormInput, SubmitEnrollmentFormInput, ListEnrollmentFormsQuery, FormData,
} from '../schemas/enrollmentForms.schema';

const EMP_JOIN = 'employees(first_name, last_name, display_id, job_title, department, work_email, email, phone, address_street, address_city, address_state, address_zip, ssn, gender, marital_status)';

export async function listEnrollmentForms(query: ListEnrollmentFormsQuery) {
  let q = supabaseAdmin.from('enrollment_forms').select(`*, ${EMP_JOIN}`, { count: 'exact' });
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.status) q = q.eq('status', query.status);
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, from + query.limit - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getEnrollmentForm(id: string) {
  const { data, error } = await supabaseAdmin
    .from('enrollment_forms').select(`*, ${EMP_JOIN}`).eq('id', id).single();
  if (error || !data) throw new NotFoundError('Enrollment form not found');
  return data;
}

export async function createEnrollmentForm(input: CreateEnrollmentFormInput, actorId?: string) {
  const { data: employee, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name, job_title, work_email, email, phone, address_street, address_city, address_state, address_zip, ssn, gender, marital_status')
    .eq('id', input.employeeId).single();
  if (empErr || !employee) throw new ValidationError('Employee not found');

  // Best-effort prefill of Section A from the employee's profile — missing
  // fields just stay blank, the employee fills the rest themselves.
  const formData: FormData = {
    sectionA: {
      lastName: employee.last_name ?? '',
      firstName: employee.first_name ?? '',
      ssn: employee.ssn ?? '',
      gender: employee.gender ?? '',
      homeAddress: {
        street: employee.address_street ?? '',
        city: employee.address_city ?? '',
        state: employee.address_state ?? '',
        zip: employee.address_zip ?? '',
      },
      mailingSameAsHome: true,
      homePhone: employee.phone ?? '',
      cellPhone: employee.phone ?? '',
      email: employee.work_email || employee.email || '',
      jobTitle: employee.job_title ?? '',
      maritalStatus: employee.marital_status ?? '',
      enrollmentType: 'New Hire',
    },
  };

  const { data, error } = await supabaseAdmin
    .from('enrollment_forms')
    .insert({
      employee_id: input.employeeId,
      created_by: actorId ?? null,
      status: 'pending',
      form_data: formData,
    })
    .select(`*, ${EMP_JOIN}`)
    .single();
  if (error || !data) throw error ?? new Error('Insert failed');

  const empName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
  void logActivity(actorId ?? null, 'created', 'enrollment_form', data.id, `Enrollment form: ${empName || data.display_id}`);

  try {
    const { data: portalUser } = await supabaseAdmin
      .from('portal_users').select('id').eq('employee_id', input.employeeId).maybeSingle();
    if (portalUser) {
      void createNotification(
        portalUser.id, 'Benefits Enrollment Form Assigned',
        'A benefits enrollment form has been assigned to you — please complete it in the portal.',
        'info', 'enrollment_form', data.id, `/portal/enrollment-forms/${data.id}`,
      );
    }
  } catch (err) {
    console.error('[enrollmentForms.service] notification failed for form', data.id, err);
  }

  return data;
}

export async function updateEnrollmentForm(id: string, input: UpdateEnrollmentFormInput, actorId?: string) {
  const existing = await getEnrollmentForm(id);
  if (existing.status !== 'pending') {
    throw new ValidationError('This form has already been submitted and can no longer be edited.');
  }

  const { data, error } = await supabaseAdmin
    .from('enrollment_forms')
    .update({ form_data: input.formData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`*, ${EMP_JOIN}`)
    .single();
  if (error || !data) throw error ?? new Error('Update failed');

  void logActivity(actorId ?? null, 'updated', 'enrollment_form', id, data.display_id ?? id.slice(0, 8));
  return data;
}

export async function submitEnrollmentForm(id: string, input: SubmitEnrollmentFormInput, actorId?: string) {
  const existing = await getEnrollmentForm(id);
  if (existing.status !== 'pending') {
    throw new ValidationError('This form has already been submitted.');
  }

  const formData = input.formData ?? existing.form_data;

  const missing: string[] = [];
  if (!formData?.sectionA?.firstName?.trim()) missing.push('First Name');
  if (!formData?.sectionA?.lastName?.trim()) missing.push('Last Name');
  if (!formData?.sectionI?.signatureName?.trim()) missing.push('Signature Name');
  if (!formData?.sectionI?.signatureDate?.trim()) missing.push('Signature Date');
  if (missing.length > 0) {
    throw new ValidationError(`Please fill in before submitting: ${missing.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('enrollment_forms')
    .update({
      form_data: formData,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`*, ${EMP_JOIN}`)
    .single();
  if (error || !data) throw error ?? new Error('Submit failed');

  void logActivity(actorId ?? null, 'submitted', 'enrollment_form', id, data.display_id ?? id.slice(0, 8));

  try {
    await generateAndStoreEnrollmentFormPdf(data);
  } catch (err) {
    console.error('[enrollmentForms.service] PDF generation failed for form', id, err);
  }

  try {
    const emp = (data as any).employees ?? {};
    const empName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || data.display_id;
    const hrIds = await getUserIdsByRole('hr');
    const adminIds = await getUserIdsByRole('admin');
    for (const uid of [...hrIds, ...adminIds]) {
      void createNotification(
        uid, 'Benefits Enrollment Form Submitted',
        `${empName} submitted their Benefits Enrollment Form.`,
        'info', 'enrollment_form', id, `/portal/enrollment-forms/${id}`,
      );
    }
  } catch (err) {
    console.error('[enrollmentForms.service] notification failed for form', id, err);
  }

  return getEnrollmentForm(id);
}

export async function deleteEnrollmentForm(id: string, actorId?: string) {
  const existing = await getEnrollmentForm(id);
  if (existing.status !== 'pending') {
    throw new ValidationError('Only pending (not yet submitted) forms can be deleted.');
  }
  const { error } = await supabaseAdmin.from('enrollment_forms').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId ?? null, 'deleted', 'enrollment_form', id, existing.display_id ?? id.slice(0, 8));
}

function buildPdfData(row: any): EnrollmentFormPDFData {
  const emp = row.employees ?? {};
  return {
    displayId: row.display_id,
    employeeName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim(),
    employeeDisplayId: emp.display_id ?? '',
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    sectionA: row.form_data?.sectionA ?? {},
    sectionB: row.form_data?.sectionB ?? {},
    sectionD: row.form_data?.sectionD ?? {},
    sectionE: row.form_data?.sectionE ?? {},
    sectionF: row.form_data?.sectionF ?? {},
    sectionG: row.form_data?.sectionG ?? [],
    sectionI: row.form_data?.sectionI ?? {},
  };
}

export async function generateAndStoreEnrollmentFormPdf(row: any): Promise<string | null> {
  const buffer = await generateEnrollmentFormPDF(buildPdfData(row));

  const fileName = `${row.display_id}.pdf`;
  const { error: uploadError } = await supabaseAdmin
    .storage.from('enrollment-forms')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = await supabaseAdmin
    .storage.from('enrollment-forms')
    .createSignedUrl(fileName, 7 * 24 * 60 * 60, { download: fileName });

  await supabaseAdmin.from('enrollment_forms').update({ pdf_url: urlData?.signedUrl }).eq('id', row.id);
  return urlData?.signedUrl ?? null;
}

export async function getEnrollmentFormPdf(id: string): Promise<string | null> {
  const row = await getEnrollmentForm(id);
  return generateAndStoreEnrollmentFormPdf(row);
}
