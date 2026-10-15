import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
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

router.get('/',    requirePermission('assets.view', 'admin','hr','operations'), validateQuery(listAssetsQuerySchema), ctrl.list);
router.post('/',   requirePermission('assets.manage', 'admin','hr'),              validateBody(createAssetSchema),      ctrl.create);
router.get('/employee/:employeeId', requirePermission('assets.view.employee-employeeId', 'admin','hr','operations','employee'), ctrl.getForEmployee);
router.get('/:id', requirePermission('assets.view', 'admin','hr','operations'),                             ctrl.getOne);
router.put('/:id', requirePermission('assets.manage', 'admin','hr'),              validateBody(updateAssetSchema),      ctrl.update);
router.post('/:id/assign',   requirePermission('assets.manage', 'admin','hr'), validateBody(assignAssetSchema), ctrl.assign);
router.post('/:id/unassign', requirePermission('assets.manage', 'admin','hr'),                                ctrl.unassign);
router.delete('/:id',        requirePermission('assets.manage', 'admin','hr'),                                ctrl.remove);

export default router;
