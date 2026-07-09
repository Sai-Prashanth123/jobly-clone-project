import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type PerformanceReviewStatus = 'draft' | 'sent';

// The 12 fixed appraisal criteria — must stay in sync with
// backend/src/schemas/performanceReviews.schema.ts's RATING_CRITERIA.
export const RATING_CRITERIA: { key: string; label: string }[] = [
  { key: 'achieves_set_objectives', label: 'Achieves Set Objectives' },
  { key: 'open_to_constructive_criticism', label: 'Open To Constructive Criticism' },
  { key: 'demonstrates_required_job_skills', label: 'Demonstrates Required Job Skills And Knowledge' },
  { key: 'demonstrates_management_leadership', label: 'Demonstrates Effective Management And Leadership Skills' },
  { key: 'completes_all_responsibilities', label: 'Completes All Assigned Responsibilities' },
  { key: 'meets_attendance_requirements', label: 'Meets Attendance Requirements' },
  { key: 'takes_responsibility_for_actions', label: 'Takes Responsibility For Actions' },
  { key: 'recognizes_problems_develops_solutions', label: 'Recognizes Potential Problems And Develops Solutions' },
  { key: 'demonstrates_problem_solving_skills', label: 'Demonstrates Problem Solving Skills' },
  { key: 'offers_constructive_suggestions', label: 'Offers Constructive Suggestions For Improvement' },
  { key: 'generates_creative_ideas', label: 'Generates Creative Ideas And Solutions' },
  { key: 'provides_alternatives', label: 'Provides Alternatives When Making Recommendations' },
];

export interface PerformanceReview {
  id: string;
  displayId: string;
  employeeId: string;
  employeeName?: string;
  employeeDisplayId?: string;
  employeeJobTitle?: string;
  employeeDepartment?: string;
  status: PerformanceReviewStatus;
  periodStart: string;
  periodEnd: string;
  salutation?: string;
  employeeNumber?: string;
  titlePayrollTitle?: string;
  employeeType?: string;
  supervisorName?: string;
  supervisedFullPeriod: boolean;
  supervisedMonths?: number;
  jobRelatedPerformance?: string;
  overallEvaluation?: string;
  ratings: Record<string, number>;
  jobFunction?: string;
  weightPercent: number;
  statusGoal?: string;
  completePercent: number;
  performanceEvaluation?: string;
  futureGoals?: string;
  employeeSignedDate?: string;
  supervisorSignedDate?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReview(raw: any): PerformanceReview {
  return {
    id: raw.id,
    displayId: raw.display_id,
    employeeId: raw.employee_id,
    employeeName: raw.employees ? `${raw.employees.first_name ?? ''} ${raw.employees.last_name ?? ''}`.trim() : undefined,
    employeeDisplayId: raw.employees?.display_id,
    employeeJobTitle: raw.employees?.job_title,
    employeeDepartment: raw.employees?.department,
    status: raw.status,
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    salutation: raw.salutation ?? undefined,
    employeeNumber: raw.employee_number ?? undefined,
    titlePayrollTitle: raw.title_payroll_title ?? undefined,
    employeeType: raw.employee_type ?? undefined,
    supervisorName: raw.supervisor_name ?? undefined,
    supervisedFullPeriod: !!raw.supervised_full_period,
    supervisedMonths: raw.supervised_months ?? undefined,
    jobRelatedPerformance: raw.job_related_performance ?? undefined,
    overallEvaluation: raw.overall_evaluation ?? undefined,
    ratings: raw.ratings ?? {},
    jobFunction: raw.job_function ?? undefined,
    weightPercent: Number(raw.weight_percent ?? 100),
    statusGoal: raw.status_goal ?? undefined,
    completePercent: Number(raw.complete_percent ?? 100),
    performanceEvaluation: raw.performance_evaluation ?? undefined,
    futureGoals: raw.future_goals ?? undefined,
    employeeSignedDate: raw.employee_signed_date ?? undefined,
    supervisorSignedDate: raw.supervisor_signed_date ?? undefined,
    pdfUrl: raw.pdf_url ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface PerformanceReviewBody {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  salutation?: string | null;
  employeeNumber?: string | null;
  titlePayrollTitle?: string | null;
  employeeType?: string | null;
  supervisorName?: string | null;
  supervisedFullPeriod?: boolean;
  supervisedMonths?: number | null;
  jobRelatedPerformance?: string | null;
  overallEvaluation?: string | null;
  ratings?: Record<string, number>;
  jobFunction?: string | null;
  weightPercent?: number;
  statusGoal?: string | null;
  completePercent?: number;
  performanceEvaluation?: string | null;
  futureGoals?: string | null;
  employeeSignedDate?: string | null;
  supervisorSignedDate?: string | null;
}

export function usePerformanceReviews(params?: { employeeId?: string; status?: PerformanceReviewStatus; limit?: number }) {
  return useQuery({
    queryKey: ['performance-reviews', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/performance-reviews', { params });
      return { data: (data.data as unknown[]).map(mapReview), total: data.total as number };
    },
  });
}

export function usePerformanceReview(id: string | undefined) {
  return useQuery({
    queryKey: ['performance-reviews', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/performance-reviews/${id}`);
      return mapReview(data.data);
    },
    enabled: !!id,
  });
}

export function useCreatePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PerformanceReviewBody) => {
      const { data } = await apiClient.post('/performance-reviews', body);
      return mapReview(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['performance-reviews'] }),
  });
}

export function useUpdatePerformanceReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<PerformanceReviewBody>) => {
      const { data } = await apiClient.put(`/performance-reviews/${id}`, body);
      return mapReview(data.data);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['performance-reviews', id], updated);
      qc.invalidateQueries({ queryKey: ['performance-reviews'] });
    },
  });
}

export function useDeletePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/performance-reviews/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['performance-reviews'] }),
  });
}

export function useGeneratePerformanceReviewPdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get(`/performance-reviews/${id}/pdf`);
      return data.url as string;
    },
  });
}

export function useSendPerformanceReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: { recipientEmail?: string }) => {
      const { data } = await apiClient.post(`/performance-reviews/${id}/send`, body ?? {});
      return {
        review: mapReview(data.review),
        emailSent: data.emailSent as boolean,
        warning: data.warning as string | undefined,
      };
    },
    onSuccess: (updated) => {
      qc.setQueryData(['performance-reviews', id], updated.review);
      qc.invalidateQueries({ queryKey: ['performance-reviews'] });
    },
  });
}
