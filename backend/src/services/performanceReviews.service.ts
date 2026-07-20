import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { createNotification, getUserIdsByRole } from './notifications.service';
import { sendPerformanceReviewEmail as mailPerformanceReview, mailerConfigured } from '../lib/mailer';
import { generatePerformanceReviewPDF, type PerformanceReviewPDFData } from '../lib/pdfGenerator';
import { RATING_CRITERIA } from '../schemas/performanceReviews.schema';
import { resolveEmployeeEmailRecipients } from '../lib/employeeCommunication';
import type {
  CreatePerformanceReviewInput, UpdatePerformanceReviewInput, ListPerformanceReviewsQuery,
} from '../schemas/performanceReviews.schema';

const EMP_JOIN = 'employees(first_name, last_name, display_id, job_title, department, work_email, email, block_personal_email)';

export async function listPerformanceReviews(query: ListPerformanceReviewsQuery) {
  let q = supabaseAdmin.from('performance_reviews').select(`*, ${EMP_JOIN}`, { count: 'exact' });
  if (query.employeeId) q = q.eq('employee_id', query.employeeId);
  if (query.status) q = q.eq('status', query.status);
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, from + query.limit - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getPerformanceReview(id: string) {
  const { data, error } = await supabaseAdmin
    .from('performance_reviews').select(`*, ${EMP_JOIN}`).eq('id', id).single();
  if (error || !data) throw new NotFoundError('Performance review not found');
  return data;
}

export async function createPerformanceReview(input: CreatePerformanceReviewInput, actorId?: string) {
  const { data: employee, error: empErr } = await supabaseAdmin
    .from('employees').select('id').eq('id', input.employeeId).single();
  if (empErr || !employee) throw new ValidationError('Employee not found');

  const { data, error } = await supabaseAdmin
    .from('performance_reviews')
    .insert({
      employee_id: input.employeeId,
      created_by: actorId ?? null,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      salutation: input.salutation ?? null,
      employee_number: input.employeeNumber ?? null,
      title_payroll_title: input.titlePayrollTitle ?? null,
      employee_type: input.employeeType ?? null,
      supervisor_name: input.supervisorName ?? null,
      supervised_full_period: input.supervisedFullPeriod ?? true,
      supervised_months: input.supervisedMonths ?? null,
      job_related_performance: input.jobRelatedPerformance ?? null,
      overall_evaluation: input.overallEvaluation ?? null,
      ratings: input.ratings ?? {},
      job_function: input.jobFunction ?? null,
      weight_percent: input.weightPercent ?? 100,
      status_goal: input.statusGoal ?? null,
      complete_percent: input.completePercent ?? 100,
      performance_evaluation: input.performanceEvaluation ?? null,
      future_goals: input.futureGoals ?? null,
      employee_signed_date: input.employeeSignedDate ?? null,
      supervisor_signed_date: input.supervisorSignedDate ?? null,
    })
    .select(`*, ${EMP_JOIN}`)
    .single();
  if (error || !data) throw error ?? new Error('Insert failed');

  const empName = `${(data as any).employees?.first_name ?? ''} ${(data as any).employees?.last_name ?? ''}`.trim();
  void logActivity(actorId ?? null, 'created', 'performance_review', data.id, `Performance review: ${empName || data.display_id}`);
  return data;
}

export async function updatePerformanceReview(id: string, input: UpdatePerformanceReviewInput, actorId?: string) {
  const existing = await getPerformanceReview(id);
  if (existing.status === 'sent') {
    throw new ValidationError('This review has already been sent and can no longer be edited.');
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    periodStart: 'period_start', periodEnd: 'period_end', salutation: 'salutation',
    employeeNumber: 'employee_number', titlePayrollTitle: 'title_payroll_title', employeeType: 'employee_type',
    supervisorName: 'supervisor_name', supervisedFullPeriod: 'supervised_full_period', supervisedMonths: 'supervised_months',
    jobRelatedPerformance: 'job_related_performance', overallEvaluation: 'overall_evaluation', ratings: 'ratings',
    jobFunction: 'job_function', weightPercent: 'weight_percent', statusGoal: 'status_goal', completePercent: 'complete_percent',
    performanceEvaluation: 'performance_evaluation', futureGoals: 'future_goals',
    employeeSignedDate: 'employee_signed_date', supervisorSignedDate: 'supervisor_signed_date',
  };
  for (const [key, column] of Object.entries(map)) {
    if ((input as Record<string, unknown>)[key] !== undefined) patch[column] = (input as Record<string, unknown>)[key];
  }

  const { data, error } = await supabaseAdmin
    .from('performance_reviews').update(patch).eq('id', id).select(`*, ${EMP_JOIN}`).single();
  if (error || !data) throw error ?? new Error('Update failed');

  void logActivity(actorId ?? null, 'updated', 'performance_review', id, data.display_id ?? id.slice(0, 8));
  return data;
}

export async function deletePerformanceReview(id: string, actorId?: string) {
  const existing = await getPerformanceReview(id);
  if (existing.status !== 'draft') {
    throw new ValidationError('Only draft reviews can be deleted.');
  }
  const { error } = await supabaseAdmin.from('performance_reviews').delete().eq('id', id);
  if (error) throw error;
  void logActivity(actorId ?? null, 'deleted', 'performance_review', id, existing.display_id ?? id.slice(0, 8));
}

function buildPdfData(row: any): PerformanceReviewPDFData {
  const emp = row.employees ?? {};
  return {
    displayId: row.display_id,
    employeeName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim(),
    employeeDisplayId: emp.display_id ?? '',
    salutation: row.salutation ?? '',
    employeeNumber: row.employee_number ?? '',
    titlePayrollTitle: row.title_payroll_title ?? emp.job_title ?? '',
    employeeType: row.employee_type ?? '',
    supervisorName: row.supervisor_name ?? '',
    supervisedFullPeriod: !!row.supervised_full_period,
    supervisedMonths: row.supervised_months ?? undefined,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    jobRelatedPerformance: row.job_related_performance ?? '',
    overallEvaluation: row.overall_evaluation ?? '',
    ratings: row.ratings ?? {},
    jobFunction: row.job_function ?? '',
    weightPercent: Number(row.weight_percent ?? 100),
    statusGoal: row.status_goal ?? '',
    completePercent: Number(row.complete_percent ?? 100),
    performanceEvaluation: row.performance_evaluation ?? '',
    futureGoals: row.future_goals ?? '',
    employeeSignedDate: row.employee_signed_date ?? undefined,
    supervisorSignedDate: row.supervisor_signed_date ?? undefined,
  };
}

// Mirrors generateAndStoreMonthlyPdf in monthlyTimesheets.service.ts exactly.
export async function generateAndStorePerformanceReviewPdf(row: any): Promise<string | null> {
  const buffer = await generatePerformanceReviewPDF(buildPdfData(row));

  const fileName = `${row.display_id}.pdf`;
  const { error: uploadError } = await supabaseAdmin
    .storage.from('performance-reviews')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = await supabaseAdmin
    .storage.from('performance-reviews')
    .createSignedUrl(fileName, 7 * 24 * 60 * 60, { download: fileName });

  await supabaseAdmin.from('performance_reviews').update({ pdf_url: urlData?.signedUrl }).eq('id', row.id);
  return urlData?.signedUrl ?? null;
}

export async function getPerformanceReviewPdf(id: string): Promise<string | null> {
  const row = await getPerformanceReview(id);
  return generateAndStorePerformanceReviewPdf(row);
}

export async function sendPerformanceReviewToEmployee(id: string, recipientEmailOverride?: string) {
  const row = await getPerformanceReview(id);
  const emp = (row as any).employees ?? {};
  const recipientEmail = recipientEmailOverride || resolveEmployeeEmailRecipients(emp)[0];
  if (!recipientEmail) {
    throw new ValidationError('This employee has no email address on file. Add one in the employee profile and try again.');
  }

  const buffer = await generatePerformanceReviewPDF(buildPdfData(row));
  await generateAndStorePerformanceReviewPdf(row); // keep pdf_url current for future downloads

  let emailSent = false;
  let warning: string | undefined;
  try {
    if (!mailerConfigured) throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
    await mailPerformanceReview({
      to: recipientEmail,
      employeeName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'Employee',
      displayId: row.display_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      pdfBuffer: buffer,
      pdfFileName: `${row.display_id}.pdf`,
    });
    emailSent = true;
  } catch (err: any) {
    warning = `The review PDF was prepared but the email could not be delivered (${err?.message ?? 'send failed'}).`;
    console.error('[performanceReviews.service] send failed for review', id, err);
  }

  const { data, error } = await supabaseAdmin
    .from('performance_reviews')
    .update({ status: emailSent ? 'sent' : row.status })
    .eq('id', id)
    .select(`*, ${EMP_JOIN}`)
    .single();
  if (error) throw error;

  if (emailSent) {
    void logActivity(null, 'sent', 'performance_review', id, `Sent to ${recipientEmail}`);
    try {
      const { data: portalUser } = await supabaseAdmin
        .from('portal_users').select('id').eq('employee_id', row.employee_id).maybeSingle();
      if (portalUser) {
        void createNotification(
          portalUser.id, 'Performance Review Available',
          `Your performance review for ${row.period_start} to ${row.period_end} is ready.`,
          'info', 'performance_review', id, '/portal/my-reviews',
        );
      }
      const hrIds = await getUserIdsByRole('hr');
      for (const uid of hrIds) {
        void createNotification(uid, 'Performance Review Sent', `Review ${row.display_id} emailed to ${recipientEmail}.`, 'info', 'performance_review', id, `/portal/reviews/${id}`);
      }
    } catch (err) {
      console.error('[performanceReviews.service] notification failed for review', id, err);
    }
  }

  return { review: data, emailSent, warning };
}

export { RATING_CRITERIA };
