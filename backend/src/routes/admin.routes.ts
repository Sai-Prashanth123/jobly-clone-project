import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as ctrl from '../controllers/admin.controller';
import { validateBody } from '../middleware/validate';
import { createStaffUserSchema } from '../schemas/adminUser.schema';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

// User management
router.get('/users',                      ctrl.listUsers);
router.post('/users',                     validateBody(createStaffUserSchema), ctrl.createUser);
router.patch('/users/:id/role',           ctrl.updateRole);
router.delete('/users/:id',               ctrl.deactivateUser);
router.post('/users/:id/reset-password',  ctrl.resetPassword);

// Activity logs
router.get('/activity-logs',              ctrl.listActivityLogs);

export default router;
