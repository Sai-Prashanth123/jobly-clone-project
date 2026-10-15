import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import {
  createExpenseSchema,
  updateExpenseSchema,
  reviewExpenseSchema,
  listExpensesQuerySchema,
} from '../schemas/expenses.schema';
import * as ctrl from '../controllers/expenses.controller';

const router = Router();
router.use(authenticate);

router.get('/',    requirePermission('expenses.view', 'admin','hr','finance','operations','employee'), validateQuery(listExpensesQuerySchema), ctrl.list);
router.post('/',   requirePermission('expenses.manage', 'admin','hr','employee'),                        validateBody(createExpenseSchema),     ctrl.create);
router.get('/:id', requirePermission('expenses.view', 'admin','hr','finance','operations','employee'),                                        ctrl.getOne);
router.put('/:id', requirePermission('expenses.manage', 'admin','hr','employee'),                        validateBody(updateExpenseSchema),     ctrl.update);
router.post('/:id/receipt', requirePermission('expenses.manage', 'admin','hr','employee'),               documentUpload.single('file'),         ctrl.uploadReceipt);
router.post('/:id/submit', requirePermission('expenses.manage', 'admin','hr','employee'),                                                       ctrl.submit);
router.post('/:id/review', requirePermission('expenses.create.id-review', 'admin','hr','finance'),                 validateBody(reviewExpenseSchema),     ctrl.review);
router.post('/:id/paid',   requirePermission('expenses.create.id-paid', 'admin','finance'),                                                             ctrl.markPaid);
router.delete('/:id',      requirePermission('expenses.manage', 'admin','hr','employee'),                                                       ctrl.remove);

export default router;
