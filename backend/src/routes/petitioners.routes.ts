import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createPetitionerSchema, updatePetitionerSchema } from '../schemas/petitioner.schema';
import * as ctrl from '../controllers/petitioners.controller';

const router = Router();

router.use(authenticate);

// Same audience as Cases — HR needs this to pick/create a petitioner while
// creating a case from the New Case form.
router.get('/', requirePermission('petitioners.view', 'admin', 'hr', 'legal'), ctrl.list);
router.post('/', requirePermission('petitioners.manage', 'admin', 'hr', 'legal'), validateBody(createPetitionerSchema), ctrl.create);
router.get('/:id', requirePermission('petitioners.view', 'admin', 'hr', 'legal'), ctrl.getOne);
router.put('/:id', requirePermission('petitioners.manage', 'admin', 'hr', 'legal'), validateBody(updatePetitionerSchema), ctrl.update);
router.delete('/:id', requirePermission('petitioners.manage', 'admin', 'hr', 'legal'), ctrl.remove);

export default router;
