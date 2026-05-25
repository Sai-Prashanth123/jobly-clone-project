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

  if (denied) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}
