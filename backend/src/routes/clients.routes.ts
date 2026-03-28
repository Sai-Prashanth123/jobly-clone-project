import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from '../schemas/client.schema';
import * as ctrl from '../controllers/clients.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', requireRole('admin','operations','finance','employee'), validateQuery(listClientsQuerySchema), ctrl.list);
router.post('/', requireRole('admin','operations'), validateBody(createClientSchema), ctrl.create);
router.get('/:id', requireRole('admin','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requireRole('admin','operations'), validateBody(updateClientSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

router.post('/:id/documents', requireRole('admin','operations'), upload.single('file'), ctrl.uploadDoc);

export default router;
