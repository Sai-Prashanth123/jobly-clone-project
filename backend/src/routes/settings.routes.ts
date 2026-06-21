import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/settings.service';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.getSettings() }); } catch (e) { next(e); }
});

router.put('/', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.updateSettings(req.body, req.user!.id) }); } catch (e) { next(e); }
});

export default router;
