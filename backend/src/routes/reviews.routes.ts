import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody as validate } from '../middleware/validate';
import * as ctrl from '../controllers/reviews.controller';
import {
  createCycleSchema, updateCycleSchema, addParticipantSchema,
  selfAssessmentSchema, managerReviewSchema, nominatePeersSchema, submitPeerFeedbackSchema,
} from '../schemas/reviews.schema';

const router = Router();
router.use(authenticate);

const HR_ADMIN = requireRole('admin', 'hr');
const ALL      = requireRole('admin', 'hr', 'operations', 'finance', 'employee');

// ── Peer feedback (must be before /:id to avoid Express matching 'peer-requests' as an id) ──
router.get ('/peer-requests/mine',        ALL,      ctrl.getMyPeerRequests);
router.post('/peer-requests/:requestId',  ALL,      validate(submitPeerFeedbackSchema), ctrl.submitPeerFeedback);

// ── Cycles ────────────────────────────────────────────────────────────────────
router.get ('/',                           ALL,      ctrl.listCycles);
router.post('/',                           HR_ADMIN, validate(createCycleSchema),  ctrl.createCycle);
router.get ('/:id',                        ALL,      ctrl.getCycle);
router.put ('/:id',                        HR_ADMIN, validate(updateCycleSchema),  ctrl.updateCycle);
router.post('/:id/activate',              HR_ADMIN, ctrl.activateCycle);
router.post('/:id/advance',               HR_ADMIN, ctrl.advanceCycle);
router.post('/:id/release',               HR_ADMIN, ctrl.releaseResults);
router.delete('/:id',                     HR_ADMIN, ctrl.deleteCycle);

// ── Participants ──────────────────────────────────────────────────────────────
router.get ('/:id/participants',           HR_ADMIN, ctrl.listParticipants);
router.post('/:id/participants',           HR_ADMIN, validate(addParticipantSchema), ctrl.addParticipant);
router.delete('/:id/participants/:employeeId', HR_ADMIN, ctrl.removeParticipant);

// ── Self-assessment (employee submits for their own record) ──────────────────
router.get ('/:id/my-review',             ALL,      ctrl.getMyParticipant);
router.post('/:id/self-assessment',       ALL,      validate(selfAssessmentSchema), ctrl.submitSelfAssessment);
router.get ('/:id/my-results',            ALL,      ctrl.getMyReviewResults);

// ── Manager review ────────────────────────────────────────────────────────────
router.post('/:id/manager-review',        HR_ADMIN, validate(managerReviewSchema), ctrl.submitManagerReview);

// ── Peer feedback ─────────────────────────────────────────────────────────────
router.post('/:id/nominate-peers',        ALL,      validate(nominatePeersSchema), ctrl.nominatePeers);

export default router;
