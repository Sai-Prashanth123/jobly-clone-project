import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { changePasswordSchema, forgotPasswordSchema } from '../schemas/auth.schema';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/login', authLimiter, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);
// Rate-limit change-password so a leaked session token can't brute-force a new
// password against the auth provider (#5 from the edge-case audit).
router.post('/change-password', authLimiter, authenticate, validateBody(changePasswordSchema), ctrl.changePassword);
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), ctrl.forgotPassword);

export default router;
