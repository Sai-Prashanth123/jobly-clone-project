import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createPerformanceReviewSchema, updatePerformanceReviewSchema,
  listPerformanceReviewsQuerySchema, sendPerformanceReviewSchema,
} from '../schemas/performanceReviews.schema';
import * as ctrl from '../controllers/performanceReviews.controller';

const router = Router();
router.use(authenticate);

// Employees may list/view/download their own reviews; only admin/hr create,
// edit, delete, or send.
router.get('/', requirePermission('performanceReviews.view', 'admin', 'hr', 'employee'), validateQuery(listPerformanceReviewsQuerySchema), ctrl.list);
router.post('/', requirePermission('performanceReviews.manage', 'admin', 'hr'), validateBody(createPerformanceReviewSchema), ctrl.create);
router.get('/:id', requirePermission('performanceReviews.view', 'admin', 'hr', 'employee'), ctrl.getOne);
router.put('/:id', requirePermission('performanceReviews.manage', 'admin', 'hr'), validateBody(updatePerformanceReviewSchema), ctrl.update);
router.delete('/:id', requirePermission('performanceReviews.manage', 'admin', 'hr'), ctrl.remove);
router.get('/:id/pdf', requirePermission('performanceReviews.view', 'admin', 'hr', 'employee'), ctrl.getPdf);
router.post('/:id/send', requirePermission('performanceReviews.manage', 'admin', 'hr'), validateBody(sendPerformanceReviewSchema), ctrl.send);

export default router;
