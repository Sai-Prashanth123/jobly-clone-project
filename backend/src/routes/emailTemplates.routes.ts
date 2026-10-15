import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createEmailTemplateSchema, updateEmailTemplateSchema, bulkClientEmailSchema, listEmailTemplatesQuerySchema } from '../schemas/emailTemplate.schema';
import * as ctrl from '../controllers/emailTemplates.controller';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('emailTemplates.view', 'admin', 'finance'), validateQuery(listEmailTemplatesQuerySchema), ctrl.list);
router.post('/', requirePermission('emailTemplates.manage', 'admin', 'finance'), validateBody(createEmailTemplateSchema), ctrl.create);
// Bulk "Email clients" blast — declared before /:id so it isn't shadowed.
router.post('/send', requirePermission('emailTemplates.manage', 'admin', 'finance'), validateBody(bulkClientEmailSchema), ctrl.sendBulk);
router.get('/:id', requirePermission('emailTemplates.view', 'admin', 'finance'), ctrl.getOne);
router.put('/:id', requirePermission('emailTemplates.manage', 'admin', 'finance'), validateBody(updateEmailTemplateSchema), ctrl.update);
router.delete('/:id', requirePermission('emailTemplates.manage', 'admin', 'finance'), ctrl.remove);

export default router;
