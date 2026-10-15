import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createTaxDocumentSchema, updateTaxDocumentSchema } from '../schemas/taxDocuments.schema';
import * as svc from '../services/taxDocuments.service';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('taxDocuments.view', 'admin', 'finance', 'hr', 'employee'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = { employeeId: req.query.employeeId as string | undefined, taxYear: req.query.taxYear ? Number(req.query.taxYear) : undefined };
    // employees can only see their own docs
    if (req.user!.role === 'employee' && req.user!.employeeId) params.employeeId = req.user!.employeeId;
    res.json({ success: true, data: await svc.listTaxDocuments(params) });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('taxDocuments.manage', 'admin', 'finance'), validateBody(createTaxDocumentSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.createTaxDocument(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', requirePermission('taxDocuments.manage', 'admin', 'finance'), validateBody(updateTaxDocumentSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateTaxDocument(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('taxDocuments.manage', 'admin', 'finance'), async (req, res, next) => {
  try { await svc.deleteTaxDocument(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
