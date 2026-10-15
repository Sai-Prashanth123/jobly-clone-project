import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { updateSettingsSchema } from '../schemas/settings.schema';
import * as svc from '../services/settings.service';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('settings.view', 'admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.getSettings() }); } catch (e) { next(e); }
});

router.put('/', requirePermission('settings.manage', 'admin'), validateBody(updateSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.updateSettings(req.body, req.user!.id) }); } catch (e) { next(e); }
});

export default router;
