import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createHolidaySchema, updateHolidaySchema } from '../schemas/holidays.schema';
import * as svc from '../services/holidays.service';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('holidays.view', 'admin','hr','operations','finance','employee'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json({ success: true, data: await svc.listHolidays(year) });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('holidays.manage', 'admin','hr'), validateBody(createHolidaySchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.createHoliday(req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', requirePermission('holidays.manage', 'admin','hr'), validateBody(updateHolidaySchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.updateHoliday(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', requirePermission('holidays.manage', 'admin','hr'), async (req: Request, res: Response, next: NextFunction) => {
  try { await svc.deleteHoliday(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
