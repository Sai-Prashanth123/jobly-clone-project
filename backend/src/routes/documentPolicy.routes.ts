import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import * as svc from '../services/documentPolicy.service';

/**
 * Which documents each work status needs.
 *
 * READING is open to everyone who can onboard or review an onboarding — the
 * wizard itself needs it, and an employee filling in their own forms has to
 * know what is being asked of them.
 *
 * WRITING is admin and HR. HR files these documents daily and will spot a
 * missing requirement first; waiting for an admin is the delay this exists to
 * remove. It is still a narrow door: this policy decides whether somebody can
 * finish onboarding.
 */
const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('documentPolicy.view', 'admin', 'hr', 'operations', 'finance', 'legal', 'employee'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await svc.getPolicy() }); } catch (e) { next(e); }
  },
);

const stateSchema = z.object({
  document_key: z.string().min(1).max(80),
  visa_type: z.string().min(1).max(40),
  state: z.enum(['required', 'optional', 'hidden']),
});

router.patch(
  '/state',
  requirePermission('documentPolicy.manage', 'admin', 'hr'),
  validateBody(stateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warning } = await svc.setState(req.body, req.user!.id);
      res.json({ success: true, warning });
    } catch (e) { next(e); }
  },
);

const aliasSchema = z.object({
  // Capped and trimmed: these are matched against free-text document names, so
  // an accidental paste should not become a permanent alias.
  aliases: z.array(z.string().trim().min(1).max(200)).max(25),
});

router.patch(
  '/:key/aliases',
  requirePermission('documentPolicy.manage', 'admin', 'hr'),
  validateBody(aliasSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await svc.setAliases(req.params.key, req.body.aliases, req.user!.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

const categorySchema = z.object({
  // A closed list: these drive section headings on four screens, so a typo
  // would silently create an eighth group containing one document.
  category: z.enum([
    'identity', 'work_auth', 'questionnaire', 'employment',
    'background', 'project', 'employer',
  ]),
});

router.patch(
  '/:key/category',
  requirePermission('documentPolicy.manage', 'admin', 'hr'),
  validateBody(categorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await svc.setCategory(req.params.key, req.body.category, req.user!.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

export default router;
