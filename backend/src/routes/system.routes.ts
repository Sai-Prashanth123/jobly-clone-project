import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { mailerConfigured } from '../lib/mailer';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/system/mailer-status
 * Returns whether the Gmail SMTP transport has both required env vars set.
 * Used by the portal to surface a one-line banner when welcome / invoice
 * emails will silently fail at send time.
 */
router.get('/mailer-status', (_req: Request, res: Response) => {
  const fromAddress = process.env.GMAIL_USER?.trim() ?? null;
  res.json({
    success: true,
    data: {
      configured: mailerConfigured,
      fromAddress: mailerConfigured ? fromAddress : null,
    },
  });
});

export default router;
