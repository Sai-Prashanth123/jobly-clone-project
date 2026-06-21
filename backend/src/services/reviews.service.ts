import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { createNotification } from './notifications.service';
import { getPortalUserByEmployeeId, getUserIdsByRole } from './notifications.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors';
import type {
  CreateCycleInput, UpdateCycleInput, AddParticipantInput,
  SelfAssessmentInput, ManagerReviewInput, NominatePeersInput, SubmitPeerFeedbackInput,
} from '../schemas/reviews.schema';

const CYCLE_SELECT = `
  id, display_id, name, description, review_type, status,
  self_assessment_due, peer_feedback_due, manager_review_due,
  results_released_at, created_by, deleted_at, created_at, updated_at,
  creator:portal_users!created_by(name)
`.trim();

const PARTICIPANT_SELECT = `
  id, cycle_id, employee_id, manager_id,
  self_strengths, self_improvements, self_goals, self_rating, self_submitted_at,
  manager_rating, manager_strengths, manager_improvements, manager_goals, manager_submitted_at,
  overall_rating, released_at,
  employee:employees!employee_id(id, first_name, last_name, display_id, job_title, department),
  manager:employees!manager_id(id, first_name, last_name, display_id)
`.trim();

// ── Cycles ──────────────────────────────────────────────────────────────────

export async function listCycles() {
  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .select(CYCLE_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCycle(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .select(CYCLE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new NotFoundError('Review cycle not found');
  return data as any;
}

export async function createCycle(input: CreateCycleInput, actorId: string) {
  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .insert({
      name:                input.name,
      description:         input.description ?? null,
      review_type:         input.reviewType,
      self_assessment_due: input.selfAssessmentDue ?? null,
      peer_feedback_due:   input.peerFeedbackDue ?? null,
      manager_review_due:  input.managerReviewDue ?? null,
      created_by:          actorId,
    })
    .select(CYCLE_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Insert returned no data');
  const row = data as any;
  void logActivity(actorId, 'created', 'employee', row.id, `Created review cycle: ${row.name}`);
  return row;
}

export async function updateCycle(id: string, input: UpdateCycleInput, actorId: string) {
  const cycle = await getCycle(id);
  if (cycle.status === 'completed') throw new ForbiddenError('Cannot edit a completed cycle');

  const patch: Record<string, unknown> = {};
  if (input.name               !== undefined) patch.name                = input.name;
  if (input.description        !== undefined) patch.description         = input.description ?? null;
  if (input.reviewType         !== undefined) patch.review_type         = input.reviewType;
  if (input.selfAssessmentDue  !== undefined) patch.self_assessment_due = input.selfAssessmentDue ?? null;
  if (input.peerFeedbackDue    !== undefined) patch.peer_feedback_due   = input.peerFeedbackDue ?? null;
  if (input.managerReviewDue   !== undefined) patch.manager_review_due  = input.managerReviewDue ?? null;

  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .update(patch)
    .eq('id', id)
    .select(CYCLE_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'employee', id, `Updated review cycle: ${cycle.name}`);
  return data as any;
}

export async function activateCycle(id: string, actorId: string) {
  const cycle = await getCycle(id);
  if (cycle.status !== 'draft') throw new ForbiddenError('Only draft cycles can be activated');

  const { data: participants } = await supabaseAdmin
    .from('review_participants')
    .select('id')
    .eq('cycle_id', id);
  if (!participants || participants.length === 0) {
    throw new ForbiddenError('Add at least one participant before activating');
  }

  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .update({ status: 'active' })
    .eq('id', id)
    .select(CYCLE_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'status_changed', 'employee', id, `Activated review cycle: ${cycle.name}`);

  // Notify all participants
  const { data: parts } = await supabaseAdmin
    .from('review_participants')
    .select('employee_id')
    .eq('cycle_id', id);
  for (const p of parts ?? []) {
    const userId = await getPortalUserByEmployeeId(p.employee_id);
    if (userId) {
      void createNotification(userId, 'Performance Review Started', `Review cycle "${cycle.name}" is now active — complete your self-assessment`, 'info', 'employee', id);
    }
  }
  return data as any;
}

export async function advanceCycleStatus(id: string, toStatus: 'peer_feedback' | 'manager_review', actorId: string) {
  const cycle = await getCycle(id);
  const valid: Record<string, string> = { active: 'peer_feedback', peer_feedback: 'manager_review' };
  if (valid[cycle.status] !== toStatus) throw new ForbiddenError(`Cannot move from ${cycle.status} to ${toStatus}`);

  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .update({ status: toStatus })
    .eq('id', id)
    .select(CYCLE_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'status_changed', 'employee', id, `Advanced cycle to ${toStatus}: ${cycle.name}`);
  return data as any;
}

export async function releaseResults(id: string, actorId: string) {
  const cycle = await getCycle(id);
  if (!['manager_review', 'peer_feedback', 'active'].includes(cycle.status)) {
    throw new ForbiddenError('Cycle must be active or in review phases before releasing results');
  }

  // Compute overall_rating for each participant
  const { data: parts } = await supabaseAdmin
    .from('review_participants')
    .select(`id, employee_id, manager_rating, peer_feedback_requests!cycle_id(rating, status)`)
    .eq('cycle_id', id);

  for (const p of parts ?? []) {
    const peerRatings = (p.peer_feedback_requests ?? [])
      .filter((r: any) => r.status === 'submitted' && r.rating != null)
      .map((r: any) => r.rating as number);
    const avgPeer = peerRatings.length > 0 ? peerRatings.reduce((a: number, b: number) => a + b, 0) / peerRatings.length : null;
    const mgr = p.manager_rating ?? null;
    let overall: number | null = null;
    if (mgr != null && avgPeer != null) overall = Math.round((mgr * 0.6 + avgPeer * 0.4) * 100) / 100;
    else if (mgr != null) overall = mgr;
    else if (avgPeer != null) overall = Math.round(avgPeer * 100) / 100;

    await supabaseAdmin
      .from('review_participants')
      .update({ overall_rating: overall, released_at: new Date().toISOString() })
      .eq('id', p.id);

    // Notify employee
    const userId = await getPortalUserByEmployeeId(p.employee_id);
    if (userId && overall != null) {
      void createNotification(userId, 'Review Results Available', `Your performance review results for "${cycle.name}" are now available`, 'success', 'employee', id);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('review_cycles')
    .update({ status: 'completed', results_released_at: new Date().toISOString() })
    .eq('id', id)
    .select(CYCLE_SELECT)
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'status_changed', 'employee', id, `Released results for cycle: ${cycle.name}`);
  return data as any;
}

export async function deleteCycle(id: string, actorId: string) {
  const cycle = await getCycle(id);
  if (cycle.status !== 'draft') throw new ForbiddenError('Only draft cycles can be deleted');
  const { error } = await supabaseAdmin
    .from('review_cycles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'employee', id, `Deleted review cycle: ${cycle.name}`);
}

// ── Participants ─────────────────────────────────────────────────────────────

export async function listParticipants(cycleId: string) {
  const { data, error } = await supabaseAdmin
    .from('review_participants')
    .select(PARTICIPANT_SELECT)
    .eq('cycle_id', cycleId)
    .order('created_at' as any, { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addParticipant(cycleId: string, input: AddParticipantInput, actorId: string) {
  await getCycle(cycleId);
  const { data, error } = await supabaseAdmin
    .from('review_participants')
    .insert({
      cycle_id:    cycleId,
      employee_id: input.employeeId,
      manager_id:  input.managerId ?? null,
    })
    .select(PARTICIPANT_SELECT)
    .single();
  if (error) {
    if ((error as any).code === '23505') throw new ConflictError('Employee already in this cycle');
    throw error;
  }
  void logActivity(actorId, 'created', 'employee', (data as any).id as string, `Added participant to cycle ${cycleId}`);
  return data as any;
}

export async function removeParticipant(cycleId: string, employeeId: string, actorId: string) {
  const cycle = await getCycle(cycleId);
  if (cycle.status !== 'draft') throw new ForbiddenError('Can only remove participants from draft cycles');
  const { error } = await supabaseAdmin
    .from('review_participants')
    .delete()
    .eq('cycle_id', cycleId)
    .eq('employee_id', employeeId);
  if (error) throw error;
  void logActivity(actorId, 'deleted', 'employee', employeeId, `Removed participant from cycle ${cycleId}`);
}

// ── Self-assessment ──────────────────────────────────────────────────────────

export async function submitSelfAssessment(cycleId: string, input: SelfAssessmentInput, actorEmployeeId: string, actorId: string) {
  const cycle = await getCycle(cycleId);
  if (!['active', 'peer_feedback'].includes(cycle.status)) {
    throw new ForbiddenError('Self-assessments can only be submitted while the cycle is active');
  }

  const { data, error } = await supabaseAdmin
    .from('review_participants')
    .update({
      self_strengths:    input.strengths ?? null,
      self_improvements: input.improvements ?? null,
      self_goals:        input.goals ?? null,
      self_rating:       input.rating ?? null,
      self_submitted_at: new Date().toISOString(),
    })
    .eq('cycle_id', cycleId)
    .eq('employee_id', actorEmployeeId)
    .select(PARTICIPANT_SELECT)
    .single();
  if (error || !data) throw new NotFoundError('You are not a participant in this cycle');
  void logActivity(actorId, 'updated', 'employee', (data as any).id, `Submitted self-assessment for cycle ${cycle.name}`);

  // Notify HR
  const hrIds = await getUserIdsByRole('hr');
  const adminIds = await getUserIdsByRole('admin');
  for (const uid of [...new Set([...hrIds, ...adminIds])]) {
    void createNotification(uid, 'Self-Assessment Submitted', `An employee submitted their self-assessment for "${cycle.name}"`, 'info', 'employee', cycleId);
  }
  return data as any;
}

export async function getMyParticipant(cycleId: string, employeeId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('review_participants')
    .select(PARTICIPANT_SELECT)
    .eq('cycle_id', cycleId)
    .eq('employee_id', employeeId)
    .single();
  if (error || !data) throw new NotFoundError('You are not a participant in this cycle');
  return data as any;
}

// ── Manager review ───────────────────────────────────────────────────────────

export async function submitManagerReview(cycleId: string, input: ManagerReviewInput, actorId: string) {
  const cycle = await getCycle(cycleId);
  if (!['active','peer_feedback','manager_review'].includes(cycle.status)) {
    throw new ForbiddenError('Manager reviews can only be submitted while the cycle is in review');
  }

  const { data, error } = await supabaseAdmin
    .from('review_participants')
    .update({
      manager_rating:       input.rating ?? null,
      manager_strengths:    input.strengths ?? null,
      manager_improvements: input.improvements ?? null,
      manager_goals:        input.goals ?? null,
      manager_submitted_at: new Date().toISOString(),
    })
    .eq('cycle_id', cycleId)
    .eq('employee_id', input.employeeId)
    .select(PARTICIPANT_SELECT)
    .single();
  if (error || !data) throw new NotFoundError('Participant not found in this cycle');
  void logActivity(actorId, 'updated', 'employee', (data as any).id, `Submitted manager review for employee ${input.employeeId} in cycle ${cycle.name}`);
  return data as any;
}

// ── Peer feedback ────────────────────────────────────────────────────────────

export async function nominatePeers(cycleId: string, input: NominatePeersInput, actorEmployeeId: string, actorId: string) {
  const cycle = await getCycle(cycleId);
  if (!['active','peer_feedback'].includes(cycle.status)) {
    throw new ForbiddenError('Peer nominations only allowed while cycle is active or in peer_feedback phase');
  }

  // Check actorEmployee is a participant
  const { data: part } = await supabaseAdmin
    .from('review_participants')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('employee_id', actorEmployeeId)
    .single();
  if (!part) throw new ForbiddenError('You are not a participant in this cycle');

  const rows = input.peerEmployeeIds
    .filter(pid => pid !== actorEmployeeId)
    .map(pid => ({ cycle_id: cycleId, reviewee_id: actorEmployeeId, reviewer_id: pid }));

  if (rows.length === 0) throw new ForbiddenError('Cannot nominate yourself');

  const { error } = await supabaseAdmin
    .from('peer_feedback_requests')
    .upsert(rows, { onConflict: 'cycle_id,reviewee_id,reviewer_id', ignoreDuplicates: true });
  if (error) throw error;

  // Notify nominated peers
  for (const pid of input.peerEmployeeIds) {
    const userId = await getPortalUserByEmployeeId(pid);
    if (userId) {
      void createNotification(userId, 'Peer Feedback Requested', `You have been nominated to give peer feedback in "${cycle.name}"`, 'info', 'employee', cycleId);
    }
  }
  void logActivity(actorId, 'created', 'employee', cycleId, `Nominated ${rows.length} peers in cycle ${cycle.name}`);
}

export async function getMyPeerRequests(reviewerEmployeeId: string) {
  const { data, error } = await supabaseAdmin
    .from('peer_feedback_requests')
    .select(`
      id, cycle_id, status, rating, strengths, improvements, submitted_at,
      reviewee:employees!reviewee_id(id, first_name, last_name, display_id, job_title),
      cycle:review_cycles!cycle_id(id, name, status, peer_feedback_due)
    `)
    .eq('reviewer_id', reviewerEmployeeId)
    .order('submitted_at' as any, { ascending: false, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function submitPeerFeedback(requestId: string, input: SubmitPeerFeedbackInput, reviewerEmployeeId: string, actorId: string) {
  const { data: req, error: reqErr } = await supabaseAdmin
    .from('peer_feedback_requests')
    .select('id, cycle_id, reviewee_id, reviewer_id, status')
    .eq('id', requestId)
    .single();
  if (reqErr || !req) throw new NotFoundError('Peer feedback request not found');
  if ((req as any).reviewer_id !== reviewerEmployeeId) throw new ForbiddenError('Not your request');
  if ((req as any).status === 'submitted') throw new ConflictError('Already submitted');

  const { data, error } = await supabaseAdmin
    .from('peer_feedback_requests')
    .update({
      status:       'submitted',
      rating:       input.rating ?? null,
      strengths:    input.strengths ?? null,
      improvements: input.improvements ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Update returned no data');
  void logActivity(actorId, 'updated', 'employee', requestId, 'Submitted peer feedback');
}

// ── Results (anonymized for employees) ───────────────────────────────────────

export async function getMyReviewResults(cycleId: string, employeeId: string) {
  const { data: part, error } = await supabaseAdmin
    .from('review_participants')
    .select(`
      self_rating, self_strengths, self_improvements, self_goals, self_submitted_at,
      manager_rating, manager_strengths, manager_improvements, manager_goals, manager_submitted_at,
      overall_rating, released_at,
      cycle:review_cycles!cycle_id(name, status, results_released_at)
    `)
    .eq('cycle_id', cycleId)
    .eq('employee_id', employeeId)
    .single();
  if (error || !part) throw new NotFoundError('You are not a participant in this cycle');
  if (!(part as any).released_at) throw new ForbiddenError('Results have not been released yet');

  // Aggregate peer feedback — NEVER return individual peer names/IDs
  const { data: peers } = await supabaseAdmin
    .from('peer_feedback_requests')
    .select('rating, strengths, improvements')
    .eq('cycle_id', cycleId)
    .eq('reviewee_id', employeeId)
    .eq('status', 'submitted');

  const peerRatings = (peers ?? []).filter((p: any) => p.rating != null).map((p: any) => p.rating as number);
  const avgPeerRating = peerRatings.length > 0 ? peerRatings.reduce((a, b) => a + b, 0) / peerRatings.length : null;
  const peerStrengths = (peers ?? []).filter((p: any) => p.strengths).map((p: any) => p.strengths as string);
  const peerImprovements = (peers ?? []).filter((p: any) => p.improvements).map((p: any) => p.improvements as string);

  return {
    ...part as any,
    peerFeedbackSummary: {
      peerCount: peerRatings.length,
      avgPeerRating: avgPeerRating != null ? Math.round(avgPeerRating * 10) / 10 : null,
      aggregatedStrengths: peerStrengths,
      aggregatedImprovements: peerImprovements,
    },
  };
}
