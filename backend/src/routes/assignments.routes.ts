import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createAssignmentSchema, updateAssignmentSchema, listAssignmentsQuerySchema } from '../schemas/assignment.schema';
import * as ctrl from '../controllers/assignments.controller';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('assignments.view', 'admin','hr','operations','finance','employee'), validateQuery(listAssignmentsQuerySchema), ctrl.list);
router.post('/', requirePermission('assignments.create', 'admin','operations'), validateBody(createAssignmentSchema), ctrl.create);
router.get('/:id', requirePermission('assignments.view', 'admin','hr','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requirePermission('assignments.edit', 'admin','operations'), validateBody(updateAssignmentSchema), ctrl.update);
router.delete('/:id', requirePermission('assignments.delete', 'admin'), ctrl.remove);

export default router;
