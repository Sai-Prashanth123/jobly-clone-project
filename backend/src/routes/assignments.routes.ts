import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema } from '../schemas/assignment.schema';
import * as ctrl from '../controllers/assignments.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin','hr','operations','finance','employee'), validateQuery(listAssignmentsQuerySchema), ctrl.list);
router.post('/', requireRole('admin','operations'), validateBody(createAssignmentSchema), ctrl.create);
router.get('/:id', requireRole('admin','hr','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requireRole('admin','operations'), validateBody(updateAssignmentSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

export default router;
