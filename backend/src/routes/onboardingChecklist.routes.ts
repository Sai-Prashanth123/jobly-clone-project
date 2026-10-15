import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
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
router.get('/templates',      requirePermission('onboardingChecklist.view', 'admin','hr'), ctrl.listTemplates);
router.post('/templates',     requirePermission('onboardingChecklist.manage', 'admin','hr'), validateBody(createTemplateSchema), ctrl.createTemplate);
router.put('/templates/:id',  requirePermission('onboardingChecklist.manage', 'admin','hr'), validateBody(updateTemplateSchema), ctrl.updateTemplate);
router.delete('/templates/:id', requirePermission('onboardingChecklist.manage', 'admin','hr'), ctrl.deleteTemplate);

// Employee tasks
router.get('/tasks/:employeeId',         requirePermission('onboardingChecklist.view', 'admin','hr'), ctrl.getEmployeeTasks);
router.post('/tasks/:employeeId',        requirePermission('onboardingChecklist.manage', 'admin','hr'), validateBody(addCustomTaskSchema), ctrl.addCustomTask);
router.patch('/tasks/:taskId/toggle',    requirePermission('onboardingChecklist.manage', 'admin','hr'), ctrl.toggleTask);

export default router;
