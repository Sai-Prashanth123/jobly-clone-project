import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createInvoiceTemplateSchema, updateInvoiceTemplateSchema } from '../schemas/invoiceTemplate.schema';
import * as ctrl from '../controllers/invoiceTemplates.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'finance'), ctrl.list);
router.post('/', requireRole('admin', 'finance'), validateBody(createInvoiceTemplateSchema), ctrl.create);
router.put('/:id', requireRole('admin', 'finance'), validateBody(updateInvoiceTemplateSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'finance'), ctrl.remove);

export default router;
