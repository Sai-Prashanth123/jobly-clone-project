import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getNavBadges } from '../services/navBadges.service';

const router = Router();

router.use(authenticate);

// Consolidated sidebar badge counts — one call instead of 7 polled endpoints.
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getNavBadges({
      id: req.user!.id,
      role: req.user!.role,
      employeeId: req.user!.employeeId,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
