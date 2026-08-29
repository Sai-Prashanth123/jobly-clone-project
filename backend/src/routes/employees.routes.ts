import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema, placeOnLeaveSchema, terminateEmployeeSchema, raiseLegalRequestSchema } from '../schemas/employee.schema';
import * as ctrl from '../controllers/employees.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.get('/', requireRole('admin','hr','operations','finance','employee','legal'), validateQuery(listEmployeesQuerySchema), ctrl.list);
router.post('/', requireRole('admin','hr'), validateBody(createEmployeeSchema), ctrl.create);
router.get('/export',             requireRole('admin', 'hr', 'operations'), ctrl.exportEmployees);
router.get('/directory',          requireRole('admin','hr','operations','finance'), ctrl.directory);
router.get('/expiring-documents', requireRole('admin','hr','legal'), ctrl.expiringDocuments);
router.get('/:id', requireRole('admin','hr','operations','finance','employee','legal'), ctrl.getOne);
// 'employee' is allowed so a user can edit their own profile; the controller
// enforces that an employee may only update their OWN record (ownership check).
router.put('/:id', requireRole('admin','hr','employee'), validateBody(updateEmployeeSchema), ctrl.update);
router.delete('/:id', requireRole('admin','hr'), ctrl.remove);
router.post('/:id/resend-credentials', requireRole('admin','hr'), ctrl.resendCredentials);

// Part B — extended leave (status → inactive + return window; login kept).
router.post('/:id/leave', requireRole('admin','hr'), validateBody(placeOnLeaveSchema), ctrl.placeOnLeave);
router.post('/:id/return-from-leave', requireRole('admin','hr'), ctrl.returnFromLeave);
// Part C — terminate (disable login, keep record) + re-hire (restore access).
router.post('/:id/terminate', requireRole('admin','hr'), validateBody(terminateEmployeeSchema), ctrl.terminate);
router.post('/:id/rehire', requireRole('admin','hr'), ctrl.rehire);

router.get('/:id/assignments', requireRole('admin','hr','operations'), ctrl.assignments);
router.get('/:id/timesheets', requireRole('admin','hr','operations'), ctrl.timesheets);
router.post('/:id/photo', requireRole('admin','hr','employee'), upload.single('file'), ctrl.uploadPhoto);
router.post('/:id/dependents/:dependentId/passport', requireRole('admin','hr','employee'), upload.single('file'), ctrl.uploadDependentPassport);
router.get('/:id/dependents/:dependentId/passport-url', requireRole('admin','hr','employee','legal'), ctrl.getDependentPassportUrl);
router.post('/:id/documents', requireRole('admin','hr','employee'), upload.single('file'), ctrl.uploadDoc);
router.delete('/:id/documents/:docId', requireRole('admin','hr','employee'), ctrl.deleteDoc);
// Finalize self-onboarding (re-validates the checklist server-side, auto-activates).
router.post('/:id/onboarding/complete', requireRole('admin','hr','employee'), ctrl.completeOnboarding);
// HR asks the employee to fix something in their submitted onboarding.
router.post('/:id/onboarding/request-changes', requireRole('admin','hr'), ctrl.requestOnboardingChanges);
// Full history of past "Request Changes" messages (not just the current one).
router.get('/:id/onboarding/change-requests', requireRole('admin','hr','employee'), ctrl.getOnboardingChangeRequests);
// HR/Admin raises a request to the Legal team about this employee — creates a
// Case in the existing Legal Cases feature. Not a Cases-route RBAC widen:
// this is HR's own narrow write action, same shape as request-documents above.
router.post('/:id/legal-requests', requireRole('admin','hr'), validateBody(raiseLegalRequestSchema), ctrl.raiseLegalRequest);
// Employee self-reopens the wizard while still in the "pending review" state
// (before HR has acted). The service enforces ownership.
router.post('/:id/onboarding/reopen', requireRole('admin','hr','employee'), ctrl.reopenOnboarding);
// HR/admin asks an employee (any status) for a document or piece of
// information outside the onboarding flow.
router.post('/:id/request-documents', requireRole('admin','hr'), ctrl.requestDocuments);

export default router;
