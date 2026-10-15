import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  setEntitlementSchema,
  listBalancesQuerySchema,
} from '../schemas/leaveBalance.schema';
import * as ctrl from '../controllers/leaveBalance.controller';

const router = Router();

router.use(authenticate);

// Leave type configuration (admin + hr manage; all roles can read for display)
router.get('/types',        requirePermission('leaveBalance.view', 'admin','hr','operations','finance','employee'), ctrl.listTypes);
router.post('/types',       requirePermission('leaveBalance.manage', 'admin','hr'), validateBody(createLeaveTypeSchema), ctrl.createType);
router.put('/types/:id',    requirePermission('leaveBalance.manage', 'admin','hr'), validateBody(updateLeaveTypeSchema), ctrl.updateType);
router.delete('/types/:id', requirePermission('leaveBalance.manage', 'admin','hr'),                                     ctrl.deleteType);

// Balance queries
router.get('/balances',            requirePermission('leaveBalance.view.balances', 'admin','hr','employee'),              validateQuery(listBalancesQuerySchema), ctrl.getMyBalances);
router.get('/balances/:empId',     requirePermission('leaveBalance.view.balances-empId', 'admin','hr'),                         validateQuery(listBalancesQuerySchema), ctrl.getBalancesForEmployee);
router.put('/entitlements/:empId', requirePermission('leaveBalance.manage', 'admin','hr'),                         validateBody(setEntitlementSchema),     ctrl.setEntitlement);

export default router;
