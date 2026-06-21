import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/budgets.service';

const router = Router();
router.use(authenticate);

const FIN = requireRole('admin', 'finance');

router.get('/', FIN, async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json({ success: true, data: await svc.listBudgets(year) });
  } catch (e) { next(e); }
});

router.post('/', FIN, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.upsertBudget(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', FIN, async (req, res, next) => {
  try { await svc.deleteBudget(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

router.get('/summary', FIN, async (req, res, next) => {
  try {
    const year = Number(req.query.year ?? new Date().getFullYear());
    res.json({ success: true, data: await svc.getBudgetSummary(year) });
  } catch (e) { next(e); }
});

export default router;
