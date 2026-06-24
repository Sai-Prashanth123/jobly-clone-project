import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from '../schemas/client.schema';
import * as ctrl from '../controllers/clients.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.get('/', requireRole('admin','operations','finance','employee'), validateQuery(listClientsQuerySchema), ctrl.list);
// Client management is admin-only ("ultimate boss"): admin creates, edits,
// archives, and uploads client documents. Operations/finance can READ clients
// (operations needs the list when creating employee→client assignments) but
// cannot write to them.
router.post('/', requireRole('admin'), validateBody(createClientSchema), ctrl.create);
router.get('/:id', requireRole('admin','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requireRole('admin'), validateBody(updateClientSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

router.patch('/:id/onboarding-status', requireRole('admin', 'hr'), ctrl.patchOnboardingStatus);
router.patch('/:id/notes', requireRole('admin', 'hr'), ctrl.patchClientNotes);
router.post('/:id/documents', requireRole('admin'), upload.single('file'), ctrl.uploadDoc);

export default router;
