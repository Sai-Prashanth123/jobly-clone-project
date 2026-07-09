import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createEmailTemplateSchema, updateEmailTemplateSchema, bulkClientEmailSchema, listEmailTemplatesQuerySchema } from '../schemas/emailTemplate.schema';
import * as ctrl from '../controllers/emailTemplates.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'finance'), validateQuery(listEmailTemplatesQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'finance'), validateBody(createEmailTemplateSchema), ctrl.create);
// Bulk "Email clients" blast — declared before /:id so it isn't shadowed.
router.post('/send', requireRole('admin', 'finance'), validateBody(bulkClientEmailSchema), ctrl.sendBulk);
router.get('/:id', requireRole('admin', 'finance'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'finance'), validateBody(updateEmailTemplateSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'finance'), ctrl.remove);

export default router;
