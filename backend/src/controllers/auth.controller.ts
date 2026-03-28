import { Request, Response, NextFunction } from 'express';
import { supabaseAnon, supabaseAdmin } from '../config/supabase';
import { UnauthorizedError } from '../lib/errors';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      throw new UnauthorizedError('Email and password are required');
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      throw new UnauthorizedError(error?.message ?? 'Invalid credentials');
    }

    // Fetch portal user profile
    const { data: portalUser, error: profileError } = await supabaseAdmin
      .from('portal_users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !portalUser) {
      throw new UnauthorizedError('User profile not found. Contact your administrator.');
    }

    res.json({
      success: true,
      data: {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          id: portalUser.id,
          email: portalUser.email,
          name: portalUser.name,
          role: portalUser.role,
          employeeId: portalUser.employee_id ?? undefined,
          avatarInitials: portalUser.avatar_initials,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      await supabaseAnon.auth.signOut();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: req.user });
  } catch (err) {
    next(err);
  }
}
