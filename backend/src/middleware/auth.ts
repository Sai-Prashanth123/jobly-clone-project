import { Request, Response, NextFunction } from 'express';
import { fetchPortalUser } from '../config/supabase';
import { authProvider } from '../lib/auth';
import { UnauthorizedError } from '../lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  employeeId?: string;
  avatarInitials?: string;
  mustResetPassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    // Returns portal_users.id under either driver: Supabase's auth user id and
    // Cognito's custom:portal_id are the same value by construction.
    let userId: string;
    try {
      ({ userId } = await authProvider.verifyToken(token));
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const portalUser = await fetchPortalUser(userId);

    if (!portalUser) {
      throw new UnauthorizedError('User profile not found');
    }

    req.user = {
      id: userId,
      email: portalUser.email,
      name: portalUser.name,
      role: portalUser.role,
      employeeId: portalUser.employee_id ?? undefined,
      avatarInitials: portalUser.avatar_initials ?? undefined,
      mustResetPassword: portalUser.must_reset_password ?? false,
    };

    // Hard gate: a user who still must reset their (temporary) password gets NO
    // access beyond the endpoints required to do so. The temp password is
    // login-only — full access is granted only after they set their own password.
    const path = req.originalUrl.split('?')[0];
    const allowedWhileReset = ['/auth/change-password', '/auth/logout', '/auth/me'];
    if (req.user.mustResetPassword && !allowedWhileReset.some(p => path.endsWith(p))) {
      res.status(403).json({
        success: false,
        code: 'PASSWORD_RESET_REQUIRED',
        error: 'You must set a new password before continuing.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
