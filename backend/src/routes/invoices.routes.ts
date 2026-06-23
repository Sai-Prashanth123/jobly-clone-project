import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { generateInvoiceSchema, createInvoiceSchema, updateInvoiceSchema, listInvoicesQuerySchema } from '../schemas/invoice.schema';
import { createPaymentSchema } from '../schemas/payment.schema';
import * as ctrl from '../controllers/invoices.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin','finance'), validateQuery(listInvoicesQuerySchema), ctrl.list);
router.post('/generate', requireRole('admin','finance'), validateBody(generateInvoiceSchema), ctrl.generate);
router.post('/', requireRole('admin','finance'), validateBody(createInvoiceSchema), ctrl.create);
router.post('/:id/convert', requireRole('admin','finance'), ctrl.convert);
router.get('/export', requireRole('admin', 'finance'), ctrl.exportInvoices);
router.patch('/bulk-status', requireRole('admin', 'finance'), ctrl.bulkInvoiceStatus);
router.post('/bulk-send', requireRole('admin', 'finance'), ctrl.bulkSend);
router.get('/:id', requireRole('admin','finance'), ctrl.getOne);
router.put('/:id', requireRole('admin','finance'), validateBody(updateInvoiceSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'finance'), ctrl.remove);
router.get('/:id/pdf', requireRole('admin','finance'), ctrl.getPDF);
router.post('/:id/send', requireRole('admin','finance'), ctrl.send);

// Attachments — files attached to an invoice (stored via the generic documents
// table + 'invoices' bucket). Listing rides inside GET /:id; download reuses
// GET /documents/:id/url.
router.post('/:id/attachments', requireRole('admin','finance'), documentUpload.single('file'), ctrl.uploadAttachment);
router.delete('/:id/attachments/:docId', requireRole('admin','finance'), ctrl.deleteAttachment);

// Manual payments (partial supported)
router.get('/:id/payments', requireRole('admin','finance'), ctrl.listPayments);
router.post('/:id/payments', requireRole('admin','finance'), validateBody(createPaymentSchema), ctrl.recordPayment);
router.delete('/:id/payments/:paymentId', requireRole('admin','finance'), ctrl.deletePayment);

export default router;
