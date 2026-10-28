import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { generateInvoiceSchema, createInvoiceSchema, updateInvoiceSchema, listInvoicesQuerySchema } from '../schemas/invoice.schema';
import { createPaymentSchema } from '../schemas/payment.schema';
import * as ctrl from '../controllers/invoices.controller';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('invoices.view', 'admin','finance'), validateQuery(listInvoicesQuerySchema), ctrl.list);
router.post('/generate', requirePermission('invoices.manage', 'admin','finance'), validateBody(generateInvoiceSchema), ctrl.generate);
router.post('/', requirePermission('invoices.manage', 'admin','finance'), validateBody(createInvoiceSchema), ctrl.create);
router.post('/:id/convert', requirePermission('invoices.manage', 'admin','finance'), ctrl.convert);
router.get('/export', requirePermission('invoices.view', 'admin', 'finance'), ctrl.exportInvoices);
router.patch('/bulk-status', requirePermission('invoices.manage', 'admin', 'finance'), ctrl.bulkInvoiceStatus);
router.post('/bulk-send', requirePermission('invoices.manage', 'admin', 'finance'), ctrl.bulkSend);
router.get('/:id', requirePermission('invoices.view', 'admin','finance'), ctrl.getOne);
router.put('/:id', requirePermission('invoices.manage', 'admin','finance'), validateBody(updateInvoiceSchema), ctrl.update);
router.delete('/:id', requirePermission('invoices.manage', 'admin', 'finance'), ctrl.remove);
router.get('/:id/pdf', requirePermission('invoices.view', 'admin','finance'), ctrl.getPDF);
router.post('/:id/send', requirePermission('invoices.manage', 'admin','finance'), ctrl.send);
// Confirming an auto-draft's blockers is part of sending it, so it carries the
// same permission: anyone who may send may clear the gate, and nobody else.
router.post('/:id/acknowledge-blockers', requirePermission('invoices.manage', 'admin','finance'), ctrl.acknowledgeBlockers);
// Chase an unpaid invoice on demand. The nightly sweep sends the scheduled
// nudges; StatusBadge has told finance to 'send a reminder to the client' for
// a long time without there being any way to do it. Same permission as
// sending the invoice itself — both email the customer.
router.post('/:id/reminder', requirePermission('invoices.manage', 'admin','finance'), ctrl.remindOne);

// Attachments — files attached to an invoice (stored via the generic documents
// table + 'invoices' bucket). Listing rides inside GET /:id; download reuses
// GET /documents/:id/url.
router.post('/:id/attachments', requirePermission('invoices.manage', 'admin','finance'), documentUpload.single('file'), ctrl.uploadAttachment);
router.delete('/:id/attachments/:docId', requirePermission('invoices.manage', 'admin','finance'), ctrl.deleteAttachment);

// Manual payments (partial supported)
router.get('/:id/payments', requirePermission('invoices.view', 'admin','finance'), ctrl.listPayments);
router.post('/:id/payments', requirePermission('invoices.manage', 'admin','finance'), validateBody(createPaymentSchema), ctrl.recordPayment);
router.delete('/:id/payments/:paymentId', requirePermission('invoices.manage', 'admin','finance'), ctrl.deletePayment);

export default router;
