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
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    };

    next();
  } catch (err) {
    next(err);
  }
}
