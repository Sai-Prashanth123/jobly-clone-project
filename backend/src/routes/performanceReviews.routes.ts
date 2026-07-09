import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
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
router.get('/', requireRole('admin', 'hr', 'employee'), validateQuery(listPerformanceReviewsQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'hr'), validateBody(createPerformanceReviewSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'hr', 'employee'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'hr'), validateBody(updatePerformanceReviewSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'hr'), ctrl.remove);
router.get('/:id/pdf', requireRole('admin', 'hr', 'employee'), ctrl.getPdf);
router.post('/:id/send', requireRole('admin', 'hr'), validateBody(sendPerformanceReviewSchema), ctrl.send);

export default router;
