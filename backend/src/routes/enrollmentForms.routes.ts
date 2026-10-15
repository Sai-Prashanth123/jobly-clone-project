import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createEnrollmentFormSchema, updateEnrollmentFormSchema, submitEnrollmentFormSchema, listEnrollmentFormsQuerySchema,
} from '../schemas/enrollmentForms.schema';
import * as ctrl from '../controllers/enrollmentForms.controller';

const router = Router();
router.use(authenticate);

// HR/admin create and delete; the assigned employee fills in and submits
// their own form (PUT/submit are employee-only — HR can only view/download).
router.get('/', requirePermission('enrollmentForms.view', 'admin', 'hr', 'employee'), validateQuery(listEnrollmentFormsQuerySchema), ctrl.list);
router.post('/', requirePermission('enrollmentForms.create', 'admin', 'hr'), validateBody(createEnrollmentFormSchema), ctrl.create);
router.get('/:id', requirePermission('enrollmentForms.view', 'admin', 'hr', 'employee'), ctrl.getOne);
router.put('/:id', requirePermission('enrollmentForms.edit', 'employee'), validateBody(updateEnrollmentFormSchema), ctrl.update);
router.post('/:id/submit', requirePermission('enrollmentForms.create.id-submit', 'employee'), validateBody(submitEnrollmentFormSchema), ctrl.submit);
router.delete('/:id', requirePermission('enrollmentForms.delete', 'admin', 'hr'), ctrl.remove);
router.get('/:id/pdf', requirePermission('enrollmentForms.view', 'admin', 'hr', 'employee'), ctrl.getPdf);

export default router;
