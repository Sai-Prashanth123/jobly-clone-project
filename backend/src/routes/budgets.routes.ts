import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import * as svc from '../services/budgets.service';

const router = Router();
router.use(authenticate);

const FIN = requireRole('admin', 'finance');

const upsertBudgetSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  fiscalYear: z.number().int().min(2000).max(2100),
  budgetType: z.string().min(1, 'Budget type is required'),
  budgetAmount: z.number().min(0, 'Budget amount cannot be negative'),
  notes: z.string().max(1000).optional().nullable(),
});

router.get('/', FIN, async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json({ success: true, data: await svc.listBudgets(year) });
  } catch (e) { next(e); }
});

router.post('/', FIN, validateBody(upsertBudgetSchema), async (req, res, next) => {
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
