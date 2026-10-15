import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema, placeOnLeaveSchema, terminateEmployeeSchema, raiseLegalRequestSchema } from '../schemas/employee.schema';
import * as ctrl from '../controllers/employees.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

// 'legal' intentionally excluded — Legal Review (its only prior use for this
// endpoint) is now admin-only; legal works cases already raised to it via
// cases.service.ts's own embedded employee subset, never the full roster.
router.get('/', requirePermission('employees.view.root', 'admin','hr','operations','finance','employee'), validateQuery(listEmployeesQuerySchema), ctrl.list);
router.post('/', requirePermission('employees.create', 'admin','hr'), validateBody(createEmployeeSchema), ctrl.create);
router.get('/export',             requirePermission('employees.view', 'admin', 'hr', 'operations'), ctrl.exportEmployees);
router.get('/directory',          requirePermission('employees.view.directory', 'admin','hr','operations','finance'), ctrl.directory);
router.get('/expiring-documents', requirePermission('employees.view.expiring-documents', 'admin','hr','legal'), ctrl.expiringDocuments);
// 'legal' intentionally excluded — see the list route above.
router.get('/:id', requirePermission('employees.view.id', 'admin','hr','operations','finance','employee'), ctrl.getOne);
// 'employee' is allowed so a user can edit their own profile; the controller
// enforces that an employee may only update their OWN record (ownership check).
router.put('/:id', requirePermission('employees.edit', 'admin','hr','employee'), validateBody(updateEmployeeSchema), ctrl.update);
router.delete('/:id', requirePermission('employees.delete', 'admin','hr'), ctrl.remove);
router.post('/:id/resend-credentials', requirePermission('employees.create', 'admin','hr'), ctrl.resendCredentials);

// Part B — extended leave (status → inactive + return window; login kept).
router.post('/:id/leave', requirePermission('employees.create', 'admin','hr'), validateBody(placeOnLeaveSchema), ctrl.placeOnLeave);
router.post('/:id/return-from-leave', requirePermission('employees.create', 'admin','hr'), ctrl.returnFromLeave);
// Part C — terminate (disable login, keep record) + re-hire (restore access).
router.post('/:id/terminate', requirePermission('employees.create', 'admin','hr'), validateBody(terminateEmployeeSchema), ctrl.terminate);
router.post('/:id/rehire', requirePermission('employees.create', 'admin','hr'), ctrl.rehire);

router.get('/:id/assignments', requirePermission('employees.view', 'admin','hr','operations'), ctrl.assignments);
router.get('/:id/timesheets', requirePermission('employees.view', 'admin','hr','operations'), ctrl.timesheets);
router.post('/:id/photo', requirePermission('employees.create.id-photo', 'admin','hr','employee'), upload.single('file'), ctrl.uploadPhoto);
router.post('/:id/dependents/:dependentId/passport', requirePermission('employees.create.id-dependents-dependentId-passport', 'admin','hr','employee'), upload.single('file'), ctrl.uploadDependentPassport);
router.get('/:id/dependents/:dependentId/passport-url', requirePermission('employees.view.id-dependents-dependentId-passport-url', 'admin','hr','employee','legal'), ctrl.getDependentPassportUrl);
router.post('/:id/documents', requirePermission('employees.create.id-documents', 'admin','hr','employee'), upload.single('file'), ctrl.uploadDoc);
router.delete('/:id/documents/:docId', requirePermission('employees.delete.id-documents-docId', 'admin','hr','employee'), ctrl.deleteDoc);
// Finalize self-onboarding (re-validates the checklist server-side, auto-activates).
router.post('/:id/onboarding/complete', requirePermission('employees.create.id-onboarding-complete', 'admin','hr','employee'), ctrl.completeOnboarding);
// HR asks the employee to fix something in their submitted onboarding.
router.post('/:id/onboarding/request-changes', requirePermission('employees.create', 'admin','hr'), ctrl.requestOnboardingChanges);
// Full history of past "Request Changes" messages (not just the current one).
router.get('/:id/onboarding/change-requests', requirePermission('employees.view.id-onboarding-change-requests', 'admin','hr','employee'), ctrl.getOnboardingChangeRequests);
// HR/Admin raises a request to the Legal team about this employee — creates a
// Case in the existing Legal Cases feature. Not a Cases-route RBAC widen:
// this is HR's own narrow write action, same shape as request-documents above.
router.post('/:id/legal-requests', requirePermission('employees.create', 'admin','hr'), validateBody(raiseLegalRequestSchema), ctrl.raiseLegalRequest);
// Employee self-reopens the wizard while still in the "pending review" state
// (before HR has acted). The service enforces ownership.
router.post('/:id/onboarding/reopen', requirePermission('employees.create.id-onboarding-reopen', 'admin','hr','employee'), ctrl.reopenOnboarding);
// HR/admin asks an employee (any status) for a document or piece of
// information outside the onboarding flow.
router.post('/:id/request-documents', requirePermission('employees.create', 'admin','hr'), ctrl.requestDocuments);

export default router;
