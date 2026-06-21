import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
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
router.get('/types',        requireRole('admin','hr','operations','finance','employee'), ctrl.listTypes);
router.post('/types',       requireRole('admin','hr'), validateBody(createLeaveTypeSchema), ctrl.createType);
router.put('/types/:id',    requireRole('admin','hr'), validateBody(updateLeaveTypeSchema), ctrl.updateType);
router.delete('/types/:id', requireRole('admin','hr'),                                     ctrl.deleteType);

// Balance queries
router.get('/balances',            requireRole('admin','hr','employee'),              validateQuery(listBalancesQuerySchema), ctrl.getMyBalances);
router.get('/balances/:empId',     requireRole('admin','hr'),                         validateQuery(listBalancesQuerySchema), ctrl.getBalancesForEmployee);
router.put('/entitlements/:empId', requireRole('admin','hr'),                         validateBody(setEntitlementSchema),     ctrl.setEntitlement);

export default router;
