import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createRecurringSchema, updateRecurringSchema } from '../schemas/recurring.schema';
import * as ctrl from '../controllers/recurring.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin', 'finance'), ctrl.list);
router.post('/', requireRole('admin', 'finance'), validateBody(createRecurringSchema), ctrl.create);
router.post('/run-tick', requireRole('admin'), ctrl.runTick);          // manual full daily tick
router.get('/:id', requireRole('admin', 'finance'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'finance'), validateBody(updateRecurringSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'finance'), ctrl.remove);
router.post('/:id/run-now', requireRole('admin', 'finance'), ctrl.runNow);

export default router;
