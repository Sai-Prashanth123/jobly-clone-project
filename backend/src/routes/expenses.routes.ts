import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createExpenseSchema,
  updateExpenseSchema,
  reviewExpenseSchema,
  listExpensesQuerySchema,
} from '../schemas/expenses.schema';
import * as ctrl from '../controllers/expenses.controller';

const router = Router();
router.use(authenticate);

router.get('/',    requireRole('admin','hr','finance','operations','employee'), validateQuery(listExpensesQuerySchema), ctrl.list);
router.post('/',   requireRole('admin','hr','employee'),                        validateBody(createExpenseSchema),     ctrl.create);
router.get('/:id', requireRole('admin','hr','finance','operations','employee'),                                        ctrl.getOne);
router.put('/:id', requireRole('admin','hr','employee'),                        validateBody(updateExpenseSchema),     ctrl.update);
router.post('/:id/submit', requireRole('admin','hr','employee'),                                                       ctrl.submit);
router.post('/:id/review', requireRole('admin','hr','finance'),                 validateBody(reviewExpenseSchema),     ctrl.review);
router.post('/:id/paid',   requireRole('admin','finance'),                                                             ctrl.markPaid);
router.delete('/:id',      requireRole('admin','hr','employee'),                                                       ctrl.remove);

export default router;
