import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createPetitionerSchema, updatePetitionerSchema } from '../schemas/petitioner.schema';
import * as ctrl from '../controllers/petitioners.controller';

const router = Router();

router.use(authenticate);

// Same audience as Cases — HR needs this to pick/create a petitioner while
// creating a case from the New Case form.
router.get('/', requireRole('admin', 'hr', 'legal'), ctrl.list);
router.post('/', requireRole('admin', 'hr', 'legal'), validateBody(createPetitionerSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'hr', 'legal'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'hr', 'legal'), validateBody(updatePetitionerSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'hr', 'legal'), ctrl.remove);

export default router;
