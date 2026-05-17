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
  const denied = !!(allowedRoles && user && !allowedRoles.includes(user.role));
  const toastShown = useRef(false);

  // Surface a toast so a confused user understands why they bounced back to
  // the dashboard instead of just experiencing a broken-link feeling.
  useEffect(() => {
    if (denied && !toastShown.current) {
      toast.error("You don't have access to this page");
      toastShown.current = true;
    }
  }, [denied]);

  if (!isAuthenticated) {
    return <Navigate to={`/portal/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (denied) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}
