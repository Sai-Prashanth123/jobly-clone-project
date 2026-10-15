import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
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
router.get('/', requirePermission('leaveRequests.view', 'admin', 'hr', 'employee'), validateQuery(listLeaveRequestsQuerySchema), ctrl.list);
router.post('/', requirePermission('leaveRequests.create', 'admin', 'hr', 'employee'), validateBody(createLeaveRequestSchema), ctrl.create);
router.get('/:id', requirePermission('leaveRequests.view', 'admin', 'hr', 'employee'), ctrl.getOne);
router.patch('/:id/review', requirePermission('leaveRequests.edit', 'admin', 'hr'), validateBody(reviewLeaveRequestSchema), ctrl.review);
router.post('/:id/cancel', requirePermission('leaveRequests.create', 'admin', 'hr', 'employee'), ctrl.cancel);

export default router;
