import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { generateInvoiceSchema, updateInvoiceSchema, listInvoicesQuerySchema } from '../schemas/invoice.schema';
import * as ctrl from '../controllers/invoices.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin','finance'), validateQuery(listInvoicesQuerySchema), ctrl.list);
router.post('/generate', requireRole('admin','finance'), validateBody(generateInvoiceSchema), ctrl.generate);
router.get('/export', requireRole('admin', 'finance'), ctrl.exportInvoices);
router.patch('/bulk-status', requireRole('admin', 'finance'), ctrl.bulkInvoiceStatus);
router.get('/:id', requireRole('admin','finance'), ctrl.getOne);
router.put('/:id', requireRole('admin','finance'), validateBody(updateInvoiceSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);
router.get('/:id/pdf', requireRole('admin','finance'), ctrl.getPDF);
router.post('/:id/send', requireRole('admin','finance'), ctrl.send);

export default router;
