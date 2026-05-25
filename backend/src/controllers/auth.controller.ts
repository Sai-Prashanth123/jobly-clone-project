import { Request, Response, NextFunction } from 'express';
import { supabaseAnon, supabaseAdmin } from '../config/supabase';
import { UnauthorizedError } from '../lib/errors';
import { resetUserPassword } from '../services/admin.service';
import type { ChangePasswordInput, ForgotPasswordInput } from '../schemas/auth.schema';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.body as { email: string; password: string };

    if (!raw?.email || !raw?.password) {
      throw new UnauthorizedError('Email and password are required');
    }

    // Normalize email: Supabase Auth is case-insensitive on its end, but the
    // secondary lookup against portal_users below uses `.eq(...)` which is not.
    // Strip whitespace and lowercase to keep both sides consistent.
    const email = raw.email.trim().toLowerCase();
    const password = raw.password;

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

    // Employees must finish self-onboarding before full access; everyone else is
    // never gated. Surfaced to the frontend gate (mirrors mustResetPassword).
    let onboardingComplete = true;
    if (portalUser.role === 'employee' && portalUser.employee_id) {
      const { data: emp } = await supabaseAdmin
        .from('employees').select('onboarding_completed_at').eq('id', portalUser.employee_id).maybeSingle();
      onboardingComplete = !!emp?.onboarding_completed_at;
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
          mustResetPassword: portalUser.must_reset_password ?? false,
          onboardingComplete,
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

// Self-service password change. Serves BOTH the forced first-login reset and a
// voluntary change. Verifies the current password (so a hijacked session can't
// silently rotate it), sets the new one, and clears the must-reset flag.
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const userId = req.user!.id;
    const email = req.user!.email;

    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, error: 'New password must be different from your current password.' });
      return;
    }

    // Verify the current password by attempting a sign-in with the anon client.
    const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({ email, password: currentPassword });
    if (signInErr) {
      res.status(400).json({ success: false, error: 'Current password is incorrect.' });
      return;
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) throw updErr;

    await supabaseAdmin
      .from('portal_users')
      .update({ must_reset_password: false, password_changed_at: new Date().toISOString() })
      .eq('id', userId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Self-service "Forgot password?". To avoid leaking which emails exist, ALWAYS
// returns the same generic success. If the email maps to a portal user, we reuse
// the admin reset (fresh temp + force first-login reset + email the temp).
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as ForgotPasswordInput;
    const normalized = email.trim().toLowerCase();

    const { data: pu } = await supabaseAdmin
      .from('portal_users').select('id').eq('email', normalized).maybeSingle();
    if (pu?.id) {
      try {
        await resetUserPassword(pu.id);
      } catch (e) {
        console.error('[auth.forgotPassword] reset failed for', normalized, e);
      }
    }

    res.json({ success: true, message: 'If an account exists for that email, we’ve emailed reset instructions.' });
  } catch (err) {
    next(err);
  }
}
