import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createInvoiceTemplateSchema, updateInvoiceTemplateSchema } from '../schemas/invoiceTemplate.schema';
import * as ctrl from '../controllers/invoiceTemplates.controller';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('invoiceTemplates.view', 'admin', 'finance'), ctrl.list);
router.post('/', requirePermission('invoiceTemplates.manage', 'admin', 'finance'), validateBody(createInvoiceTemplateSchema), ctrl.create);
router.put('/:id', requirePermission('invoiceTemplates.manage', 'admin', 'finance'), validateBody(updateInvoiceTemplateSchema), ctrl.update);
router.delete('/:id', requirePermission('invoiceTemplates.manage', 'admin', 'finance'), ctrl.remove);

export default router;
