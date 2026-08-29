import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createPetitionerSchema, updatePetitionerSchema } from '../schemas/petitioner.schema';
import * as ctrl from '../controllers/petitioners.controller';

const router = Router();

router.use(authenticate);

// Same audience as Cases — petitioners only matter to Legal's case work.
router.get('/', requireRole('admin', 'legal'), ctrl.list);
router.post('/', requireRole('admin', 'legal'), validateBody(createPetitionerSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'legal'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'legal'), validateBody(updatePetitionerSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'legal'), ctrl.remove);

export default router;
