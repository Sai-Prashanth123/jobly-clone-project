import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import {
  createTemplateSchema,
  updateTemplateSchema,
  addCustomTaskSchema,
} from '../schemas/onboardingChecklist.schema';
import * as ctrl from '../controllers/onboardingChecklist.controller';

const router = Router();
router.use(authenticate);

// Templates
router.get('/templates',      requireRole('admin','hr'), ctrl.listTemplates);
router.post('/templates',     requireRole('admin','hr'), validateBody(createTemplateSchema), ctrl.createTemplate);
router.put('/templates/:id',  requireRole('admin','hr'), validateBody(updateTemplateSchema), ctrl.updateTemplate);
router.delete('/templates/:id', requireRole('admin','hr'), ctrl.deleteTemplate);

// Employee tasks
router.get('/tasks/:employeeId',         requireRole('admin','hr'), ctrl.getEmployeeTasks);
router.post('/tasks/:employeeId',        requireRole('admin','hr'), validateBody(addCustomTaskSchema), ctrl.addCustomTask);
router.patch('/tasks/:taskId/toggle',    requireRole('admin','hr'), ctrl.toggleTask);

export default router;
