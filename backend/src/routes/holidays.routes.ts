import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/holidays.service';

const router = Router();
router.use(authenticate);

const ALL    = requireRole('admin','hr','operations','finance','employee');
const ADMIN  = requireRole('admin','hr');

router.get('/', ALL, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json({ success: true, data: await svc.listHolidays(year) });
  } catch (e) { next(e); }
});

router.post('/', ADMIN, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.createHoliday(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', ADMIN, async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.updateHoliday(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', ADMIN, async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.deleteHoliday(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
