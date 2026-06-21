import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createAssetSchema,
  updateAssetSchema,
  assignAssetSchema,
  listAssetsQuerySchema,
} from '../schemas/assets.schema';
import * as ctrl from '../controllers/assets.controller';

const router = Router();
router.use(authenticate);

router.get('/',    requireRole('admin','hr','operations'), validateQuery(listAssetsQuerySchema), ctrl.list);
router.post('/',   requireRole('admin','hr'),              validateBody(createAssetSchema),      ctrl.create);
router.get('/employee/:employeeId', requireRole('admin','hr','operations','employee'), ctrl.getForEmployee);
router.get('/:id', requireRole('admin','hr','operations'),                             ctrl.getOne);
router.put('/:id', requireRole('admin','hr'),              validateBody(updateAssetSchema),      ctrl.update);
router.post('/:id/assign',   requireRole('admin','hr'), validateBody(assignAssetSchema), ctrl.assign);
router.post('/:id/unassign', requireRole('admin','hr'),                                ctrl.unassign);
router.delete('/:id',        requireRole('admin','hr'),                                ctrl.remove);

export default router;
