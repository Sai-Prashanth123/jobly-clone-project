import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createShiftSchema, updateShiftSchema } from '../schemas/shifts.schema';
import * as svc from '../services/shifts.service';

const router = Router();
router.use(authenticate);

const OPS = requireRole('admin', 'hr', 'operations');
const ALL = requireRole('admin', 'hr', 'operations', 'finance', 'employee');

router.get('/', ALL, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = { startDate: req.query.startDate as string, endDate: req.query.endDate as string, employeeId: req.query.employeeId as string };
    res.json({ success: true, data: await svc.listShifts(params) });
  } catch (e) { next(e); }
});

router.post('/', OPS, validateBody(createShiftSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.createShift(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', OPS, validateBody(updateShiftSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateShift(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', OPS, async (req, res, next) => {
  try { await svc.deleteShift(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
