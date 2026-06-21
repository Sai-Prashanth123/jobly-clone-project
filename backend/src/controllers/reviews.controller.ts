import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/reviews.service';
import type {
  CreateCycleInput, UpdateCycleInput, AddParticipantInput,
  SelfAssessmentInput, ManagerReviewInput, NominatePeersInput, SubmitPeerFeedbackInput,
} from '../schemas/reviews.schema';

function ok(res: Response, data: unknown, total?: number) {
  if (total !== undefined) return res.json({ success: true, data, total });
  return res.json({ success: true, data });
}

export async function listCycles(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.listCycles()); } catch (e) { next(e); }
}

export async function getCycle(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.getCycle(req.params.id)); } catch (e) { next(e); }
}

export async function createCycle(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.createCycle(req.body as CreateCycleInput, req.user!.id)); } catch (e) { next(e); }
}

export async function updateCycle(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.updateCycle(req.params.id, req.body as UpdateCycleInput, req.user!.id)); } catch (e) { next(e); }
}

export async function activateCycle(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.activateCycle(req.params.id, req.user!.id)); } catch (e) { next(e); }
}

export async function advanceCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const toStatus = req.body.toStatus as 'peer_feedback' | 'manager_review';
    ok(res, await svc.advanceCycleStatus(req.params.id, toStatus, req.user!.id));
  } catch (e) { next(e); }
}

export async function releaseResults(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.releaseResults(req.params.id, req.user!.id)); } catch (e) { next(e); }
}

export async function deleteCycle(req: Request, res: Response, next: NextFunction) {
  try { await svc.deleteCycle(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
}

export async function listParticipants(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.listParticipants(req.params.id)); } catch (e) { next(e); }
}

export async function addParticipant(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.addParticipant(req.params.id, req.body as AddParticipantInput, req.user!.id)); } catch (e) { next(e); }
}

export async function removeParticipant(req: Request, res: Response, next: NextFunction) {
  try { await svc.removeParticipant(req.params.id, req.params.employeeId, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
}

export async function submitSelfAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.status(403).json({ success: false, error: 'No employee record' }); return; }
    ok(res, await svc.submitSelfAssessment(req.params.id, req.body as SelfAssessmentInput, empId, req.user!.id));
  } catch (e) { next(e); }
}

export async function getMyParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.status(403).json({ success: false, error: 'No employee record' }); return; }
    ok(res, await svc.getMyParticipant(req.params.id, empId));
  } catch (e) { next(e); }
}

export async function submitManagerReview(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.submitManagerReview(req.params.id, req.body as ManagerReviewInput, req.user!.id)); } catch (e) { next(e); }
}

export async function nominatePeers(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.status(403).json({ success: false, error: 'No employee record' }); return; }
    await svc.nominatePeers(req.params.id, req.body as NominatePeersInput, empId, req.user!.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getMyPeerRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.json({ success: true, data: [] }); return; }
    ok(res, await svc.getMyPeerRequests(empId));
  } catch (e) { next(e); }
}

export async function submitPeerFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.status(403).json({ success: false, error: 'No employee record' }); return; }
    await svc.submitPeerFeedback(req.params.requestId, req.body as SubmitPeerFeedbackInput, empId, req.user!.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getMyReviewResults(req: Request, res: Response, next: NextFunction) {
  try {
    const empId = req.user!.employeeId;
    if (!empId) { res.status(403).json({ success: false, error: 'No employee record' }); return; }
    ok(res, await svc.getMyReviewResults(req.params.id, empId));
  } catch (e) { next(e); }
}
