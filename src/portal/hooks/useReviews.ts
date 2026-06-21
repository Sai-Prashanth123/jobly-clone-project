import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type CycleStatus = 'draft' | 'active' | 'peer_feedback' | 'manager_review' | 'completed';
export type ReviewType  = 'annual' | 'quarterly' | 'project' | 'probation';

export interface ReviewCycle {
  id: string;
  displayId?: string;
  name: string;
  description?: string | null;
  reviewType: ReviewType;
  status: CycleStatus;
  selfAssessmentDue?: string | null;
  peerFeedbackDue?: string | null;
  managerReviewDue?: string | null;
  resultsReleasedAt?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewParticipant {
  id: string;
  cycleId: string;
  employeeId: string;
  managerId?: string | null;
  employeeName?: string;
  employeeDisplayId?: string;
  employeeTitle?: string;
  employeeDepartment?: string;
  managerName?: string;
  selfStrengths?: string | null;
  selfImprovements?: string | null;
  selfGoals?: string | null;
  selfRating?: number | null;
  selfSubmittedAt?: string | null;
  managerRating?: number | null;
  managerStrengths?: string | null;
  managerImprovements?: string | null;
  managerGoals?: string | null;
  managerSubmittedAt?: string | null;
  overallRating?: number | null;
  releasedAt?: string | null;
}

export interface PeerRequest {
  id: string;
  cycleId: string;
  status: 'pending' | 'submitted';
  rating?: number | null;
  strengths?: string | null;
  improvements?: string | null;
  submittedAt?: string | null;
  revieweeName?: string;
  revieweeTitle?: string;
  cycleName?: string;
  cycleStatus?: CycleStatus;
  cyclePeerDue?: string | null;
}

export interface ReviewResults extends ReviewParticipant {
  peerFeedbackSummary: {
    peerCount: number;
    avgPeerRating: number | null;
    aggregatedStrengths: string[];
    aggregatedImprovements: string[];
  };
}

const STATUS_LABELS: Record<CycleStatus, string> = {
  draft:          'Draft',
  active:         'Active',
  peer_feedback:  'Peer Feedback',
  manager_review: 'Manager Review',
  completed:      'Completed',
};

const TYPE_LABELS: Record<ReviewType, string> = {
  annual:     'Annual',
  quarterly:  'Quarterly',
  project:    'Project-Based',
  probation:  'Probation',
};

export { STATUS_LABELS, TYPE_LABELS };

function mapCycle(r: any): ReviewCycle {
  return {
    id:               r.id,
    displayId:        r.display_id ?? undefined,
    name:             r.name,
    description:      r.description ?? null,
    reviewType:       r.review_type as ReviewType,
    status:           r.status as CycleStatus,
    selfAssessmentDue: r.self_assessment_due ?? null,
    peerFeedbackDue:  r.peer_feedback_due ?? null,
    managerReviewDue: r.manager_review_due ?? null,
    resultsReleasedAt: r.results_released_at ?? null,
    createdBy:        r.created_by ?? null,
    creatorName:      r.creator?.name ?? null,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

function mapParticipant(r: any): ReviewParticipant {
  const emp = r.employee ?? {};
  const mgr = r.manager ?? {};
  return {
    id:                  r.id,
    cycleId:             r.cycle_id,
    employeeId:          r.employee_id,
    managerId:           r.manager_id ?? null,
    employeeName:        emp.first_name ? `${emp.first_name} ${emp.last_name}`.trim() : undefined,
    employeeDisplayId:   emp.display_id ?? undefined,
    employeeTitle:       emp.job_title ?? undefined,
    employeeDepartment:  emp.department ?? undefined,
    managerName:         mgr.first_name ? `${mgr.first_name} ${mgr.last_name}`.trim() : undefined,
    selfStrengths:       r.self_strengths ?? null,
    selfImprovements:    r.self_improvements ?? null,
    selfGoals:           r.self_goals ?? null,
    selfRating:          r.self_rating ?? null,
    selfSubmittedAt:     r.self_submitted_at ?? null,
    managerRating:       r.manager_rating ?? null,
    managerStrengths:    r.manager_strengths ?? null,
    managerImprovements: r.manager_improvements ?? null,
    managerGoals:        r.manager_goals ?? null,
    managerSubmittedAt:  r.manager_submitted_at ?? null,
    overallRating:       r.overall_rating != null ? Number(r.overall_rating) : null,
    releasedAt:          r.released_at ?? null,
  };
}

function mapPeerRequest(r: any): PeerRequest {
  const rv = r.reviewee ?? {};
  const cy = r.cycle ?? {};
  return {
    id:           r.id,
    cycleId:      r.cycle_id,
    status:       r.status,
    rating:       r.rating ?? null,
    strengths:    r.strengths ?? null,
    improvements: r.improvements ?? null,
    submittedAt:  r.submitted_at ?? null,
    revieweeName: rv.first_name ? `${rv.first_name} ${rv.last_name}`.trim() : undefined,
    revieweeTitle: rv.job_title ?? undefined,
    cycleName:    cy.name ?? undefined,
    cycleStatus:  cy.status ?? undefined,
    cyclePeerDue: cy.peer_feedback_due ?? null,
  };
}

// ── Cycle hooks ───────────────────────────────────────────────────────────────

export function useReviewCycles() {
  return useQuery({
    queryKey: ['review-cycles'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reviews');
      return (data.data as any[]).map(mapCycle);
    },
    staleTime: 30_000,
  });
}

export function useReviewCycle(id: string | undefined) {
  return useQuery({
    queryKey: ['review-cycles', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reviews/${id}`);
      return mapCycle(data.data);
    },
    enabled: !!id,
  });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ReviewCycle> & { name: string }) => {
      const { data } = await apiClient.post('/reviews', {
        name: input.name, description: input.description,
        reviewType: input.reviewType, selfAssessmentDue: input.selfAssessmentDue,
        peerFeedbackDue: input.peerFeedbackDue, managerReviewDue: input.managerReviewDue,
      });
      return mapCycle(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-cycles'] }),
  });
}

export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ReviewCycle> & { id: string }) => {
      const { data } = await apiClient.put(`/reviews/${id}`, {
        name: input.name, description: input.description,
        reviewType: input.reviewType, selfAssessmentDue: input.selfAssessmentDue,
        peerFeedbackDue: input.peerFeedbackDue, managerReviewDue: input.managerReviewDue,
      });
      return mapCycle(data.data);
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['review-cycles'] }); qc.invalidateQueries({ queryKey: ['review-cycles', v.id] }); },
  });
}

export function useActivateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { data } = await apiClient.post(`/reviews/${id}/activate`); return mapCycle(data.data); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-cycles'] }),
  });
}

export function useAdvanceCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, toStatus }: { id: string; toStatus: 'peer_feedback' | 'manager_review' }) => {
      const { data } = await apiClient.post(`/reviews/${id}/advance`, { toStatus });
      return mapCycle(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-cycles'] }),
  });
}

export function useReleaseResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { data } = await apiClient.post(`/reviews/${id}/release`); return mapCycle(data.data); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-cycles'] }),
  });
}

export function useDeleteCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/reviews/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-cycles'] }),
  });
}

// ── Participant hooks ─────────────────────────────────────────────────────────

export function useParticipants(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['review-participants', cycleId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reviews/${cycleId}/participants`);
      return (data.data as any[]).map(mapParticipant);
    },
    enabled: !!cycleId,
    staleTime: 30_000,
  });
}

export function useAddParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, employeeId, managerId }: { cycleId: string; employeeId: string; managerId?: string | null }) => {
      const { data } = await apiClient.post(`/reviews/${cycleId}/participants`, { employeeId, managerId });
      return mapParticipant(data.data);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['review-participants', v.cycleId] }),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, employeeId }: { cycleId: string; employeeId: string }) => {
      await apiClient.delete(`/reviews/${cycleId}/participants/${employeeId}`);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['review-participants', v.cycleId] }),
  });
}

// ── Self-assessment hooks ─────────────────────────────────────────────────────

export function useMyReview(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['my-review', cycleId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reviews/${cycleId}/my-review`);
      return mapParticipant(data.data);
    },
    enabled: !!cycleId,
    staleTime: 30_000,
  });
}

export function useSubmitSelfAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, ...input }: { cycleId: string; strengths?: string; improvements?: string; goals?: string; rating?: number }) => {
      const { data } = await apiClient.post(`/reviews/${cycleId}/self-assessment`, input);
      return mapParticipant(data.data);
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['my-review', v.cycleId] }); qc.invalidateQueries({ queryKey: ['review-cycles'] }); },
  });
}

export function useMyReviewResults(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['my-review-results', cycleId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reviews/${cycleId}/my-results`);
      return data.data as ReviewResults;
    },
    enabled: !!cycleId,
    staleTime: 60_000,
    retry: false,
  });
}

// ── Manager review hooks ──────────────────────────────────────────────────────

export function useSubmitManagerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, ...input }: { cycleId: string; employeeId: string; rating?: number; strengths?: string; improvements?: string; goals?: string }) => {
      const { data } = await apiClient.post(`/reviews/${cycleId}/manager-review`, input);
      return mapParticipant(data.data);
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['review-participants', v.cycleId] }),
  });
}

// ── Peer feedback hooks ───────────────────────────────────────────────────────

export function useNominatePeers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, peerEmployeeIds }: { cycleId: string; peerEmployeeIds: string[] }) => {
      await apiClient.post(`/reviews/${cycleId}/nominate-peers`, { peerEmployeeIds });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['peer-requests'] }),
  });
}

export function useMyPeerRequests() {
  return useQuery({
    queryKey: ['peer-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/reviews/peer-requests/mine');
      return (data.data as any[]).map(mapPeerRequest);
    },
    staleTime: 30_000,
  });
}

export function useSubmitPeerFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, ...input }: { requestId: string; rating?: number; strengths?: string; improvements?: string }) => {
      await apiClient.post(`/reviews/peer-requests/${requestId}`, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['peer-requests'] }),
  });
}
