import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
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
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Fetch portal user profile
    const { data: portalUser, error: profileError } = await supabaseAdmin
      .from('portal_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !portalUser) {
      throw new UnauthorizedError('User profile not found');
    }

    req.user = {
      id: user.id,
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
