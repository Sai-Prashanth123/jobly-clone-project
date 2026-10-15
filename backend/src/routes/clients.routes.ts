import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from '../schemas/client.schema';
import * as ctrl from '../controllers/clients.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.get('/', requirePermission('clients.view', 'admin','hr','operations','finance','employee'), validateQuery(listClientsQuerySchema), ctrl.list);
// Client management is admin-only ("ultimate boss"): admin creates, edits,
// archives, and uploads client documents. HR/operations/finance can READ
// clients (HR needs client names to display on timesheets/attendance;
// operations needs the list when creating employee→client assignments) but
// cannot write to them (HR's onboarding-status/notes patches below are the
// one exception, already scoped narrowly).
router.post('/', requirePermission('clients.create', 'admin'), validateBody(createClientSchema), ctrl.create);
router.get('/:id', requirePermission('clients.view', 'admin','hr','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requirePermission('clients.edit.id', 'admin'), validateBody(updateClientSchema), ctrl.update);
router.delete('/:id', requirePermission('clients.delete', 'admin'), ctrl.remove);

router.patch('/:id/onboarding-status', requirePermission('clients.edit', 'admin', 'hr'), ctrl.patchOnboardingStatus);
router.patch('/:id/notes', requirePermission('clients.edit', 'admin', 'hr'), ctrl.patchClientNotes);
router.post('/:id/documents', requirePermission('clients.create', 'admin'), upload.single('file'), ctrl.uploadDoc);

export default router;
