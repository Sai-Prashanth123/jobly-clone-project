import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as ctrl from '../controllers/admin.controller';
import { validateBody } from '../middleware/validate';
import { createStaffUserSchema } from '../schemas/adminUser.schema';

const router = Router();

router.use(authenticate);

// User management
router.get('/users',                      requirePermission('admin.view', 'admin'), ctrl.listUsers);
router.post('/users',                     requirePermission('admin.manage', 'admin'), validateBody(createStaffUserSchema), ctrl.createUser);
router.patch('/users/:id/role',           requirePermission('admin.manage', 'admin'), ctrl.updateRole);
router.delete('/users/:id',               requirePermission('admin.manage', 'admin'), ctrl.deactivateUser);
router.post('/users/:id/reset-password',  requirePermission('admin.manage', 'admin'), ctrl.resetPassword);

// Activity logs
router.get('/activity-logs',              requirePermission('admin.view', 'admin'), ctrl.listActivityLogs);

export default router;
