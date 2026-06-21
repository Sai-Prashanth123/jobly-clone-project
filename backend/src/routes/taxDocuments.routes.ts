import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/taxDocuments.service';

const router = Router();
router.use(authenticate);

const FIN = requireRole('admin', 'finance');
const ALL = requireRole('admin', 'finance', 'hr', 'employee');

router.get('/', ALL, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = { employeeId: req.query.employeeId as string | undefined, taxYear: req.query.taxYear ? Number(req.query.taxYear) : undefined };
    // employees can only see their own docs
    if (req.user!.role === 'employee' && req.user!.employeeId) params.employeeId = req.user!.employeeId;
    res.json({ success: true, data: await svc.listTaxDocuments(params) });
  } catch (e) { next(e); }
});

router.post('/', FIN, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.createTaxDocument(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', FIN, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateTaxDocument(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', FIN, async (req, res, next) => {
  try { await svc.deleteTaxDocument(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
