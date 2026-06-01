import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  listLeaveRequestsQuerySchema,
} from '../schemas/leaveRequest.schema';
import * as ctrl from '../controllers/leaveRequests.controller';

const router = Router();

router.use(authenticate);

// Employees see/file their own; admin + hr manage all. Review (approve/reject)
// is HR/admin only.
router.get('/', requireRole('admin', 'hr', 'employee'), validateQuery(listLeaveRequestsQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'hr', 'employee'), validateBody(createLeaveRequestSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'hr', 'employee'), ctrl.getOne);
router.patch('/:id/review', requireRole('admin', 'hr'), validateBody(reviewLeaveRequestSchema), ctrl.review);
router.post('/:id/cancel', requireRole('admin', 'hr', 'employee'), ctrl.cancel);

export default router;
