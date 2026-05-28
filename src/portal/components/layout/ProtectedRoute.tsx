import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const mustReset = !!user?.mustResetPassword;
  const isForceResetRoute = location.pathname.endsWith('/force-password-reset');
  // Exact match — '/portal/hr/onboarding' (HR drill-down) must NOT count here.
  const path = location.pathname.replace(/\/$/, '');
  const isOnboardingRoute = path === '/portal/onboarding';
  const isPendingRoute = path === '/portal/onboarding/pending';
  // 4-state onboarding gate (employees only). Falls back to the legacy
  // onboardingComplete flag for sessions created before onboardingStatus existed.
  // `changes_requested` (HR sent the employee back to edit) routes to the same
  // pending screen as `pending_review`; the screen renders different copy.
  const ob: 'in_progress' | 'pending_review' | 'changes_requested' | 'approved' =
    user?.role === 'employee'
      ? (user.onboardingStatus ?? (user.onboardingComplete ? 'approved' : 'in_progress'))
      : 'approved';
  const denied = !!(allowedRoles && user && !allowedRoles.includes(user.role));
  const toastShown = useRef(false);

  // Surface a toast so a confused user understands why they bounced back to
  // the dashboard instead of just experiencing a broken-link feeling. Suppress
  // it while a forced password reset is pending (we redirect to reset, not deny).
  useEffect(() => {
    if (denied && !mustReset && !toastShown.current) {
      toast.error("You don't have access to this page");
      toastShown.current = true;
    }
  }, [denied, mustReset]);

  if (!isAuthenticated) {
    return <Navigate to={`/portal/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // A user still on a one-time temporary password must set their own password
  // before any other access. This pins them to the force-reset screen.
  if (mustReset && !isForceResetRoute) {
    return <Navigate to="/portal/force-password-reset" replace />;
  }
  // Once they've reset, don't let them linger on the force-reset screen.
  if (!mustReset && isForceResetRoute) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  // After the password reset, a new hire must finish self-onboarding AND be
  // approved by HR before reaching the app. Route by onboarding state and pin
  // them to the correct screen (wizard while filling, "awaiting review" once
  // submitted, dashboard once approved).
  if (!mustReset) {
    if (ob === 'in_progress' && !isOnboardingRoute) {
      return <Navigate to="/portal/onboarding" replace />;
    }
    if (ob === 'pending_review' && !isPendingRoute) {
      return <Navigate to="/portal/onboarding/pending" replace />;
    }
    // HR has asked the employee to revise. The pending screen is the
    // communication hub (it shows HR's message + an "Update my information"
    // CTA). The wizard is where they actually edit. Allow EITHER route — if
    // they land somewhere else, send them to pending so they read the message
    // first.
    if (ob === 'changes_requested' && !isOnboardingRoute && !isPendingRoute) {
      return <Navigate to="/portal/onboarding/pending" replace />;
    }
    if (ob === 'approved' && (isOnboardingRoute || isPendingRoute)) {
      return <Navigate to="/portal/dashboard" replace />;
    }
    // Don't let them sit on the wrong onboarding screen for their state.
    if (ob === 'in_progress' && isPendingRoute) {
      return <Navigate to="/portal/onboarding" replace />;
    }
    if (ob === 'pending_review' && isOnboardingRoute) {
      return <Navigate to="/portal/onboarding/pending" replace />;
    }
  }

  if (denied) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}
