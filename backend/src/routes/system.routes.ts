import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { emailTestSchema } from '../schemas/system.schema';
import { mailerConfigured, testEmailDelivery } from '../lib/mailer';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/system/mailer-status
 * Returns whether the Gmail SMTP transport has both required env vars set.
 * Used by the portal to surface a one-line banner when welcome / invoice
 * emails will silently fail at send time.
 */
router.get('/mailer-status', (_req: Request, res: Response) => {
  const fromAddress = process.env.MAIL_FROM?.trim() || process.env.GMAIL_USER?.trim() || null;
  res.json({
    success: true,
    data: {
      configured: mailerConfigured,
      fromAddress: mailerConfigured ? fromAddress : null,
    },
  });
});

/**
 * POST /api/v1/system/email-test
 * Admin-only. Sends a test email to verify the SMTP transport end-to-end.
 * Body: { to: string }
 */
router.post('/email-test', requireRole('admin'), validateBody(emailTestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body as { to: string };
    const { ok, error } = await testEmailDelivery(to);
    res.json({ success: true, data: { ok, error } });
  } catch (err) { next(err); }
});

export default router;
