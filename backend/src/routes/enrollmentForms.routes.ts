import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createEnrollmentFormSchema, updateEnrollmentFormSchema, submitEnrollmentFormSchema, listEnrollmentFormsQuerySchema,
} from '../schemas/enrollmentForms.schema';
import * as ctrl from '../controllers/enrollmentForms.controller';

const router = Router();
router.use(authenticate);

// HR/admin create and delete; the assigned employee fills in and submits
// their own form (PUT/submit are employee-only — HR can only view/download).
router.get('/', requireRole('admin', 'hr', 'employee'), validateQuery(listEnrollmentFormsQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'hr'), validateBody(createEnrollmentFormSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'hr', 'employee'), ctrl.getOne);
router.put('/:id', requireRole('employee'), validateBody(updateEnrollmentFormSchema), ctrl.update);
router.post('/:id/submit', requireRole('employee'), validateBody(submitEnrollmentFormSchema), ctrl.submit);
router.delete('/:id', requireRole('admin', 'hr'), ctrl.remove);
router.get('/:id/pdf', requireRole('admin', 'hr', 'employee'), ctrl.getPdf);

export default router;
