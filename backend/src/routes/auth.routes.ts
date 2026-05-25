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
router.post('/change-password', authenticate, validateBody(changePasswordSchema), ctrl.changePassword);
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), ctrl.forgotPassword);

export default router;
