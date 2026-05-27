import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';

// Shown after an employee submits self-onboarding. They stay here until HR
// approves (status → active). We poll /auth/me so approval moves them to the
// dashboard automatically; ProtectedRoute also redirects once onboardingStatus
// becomes 'approved'.
export default function OnboardingPending() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);

  // Already approved (or not an onboarding employee)? Don't linger here.
  useEffect(() => {
    if (user?.role !== 'employee' || user?.onboardingStatus === 'approved') {
      navigate('/portal/dashboard', { replace: true });
    }
  }, [user?.onboardingStatus, user?.role, navigate]);

  // Poll for HR approval.
  useEffect(() => {
    const id = setInterval(() => { void refreshUser(); }, 20000);
    return () => clearInterval(id);
  }, [refreshUser]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await refreshUser();
    } finally {
      setChecking(false);
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className="portal-scope min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Onboarding submitted</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          Thanks{firstName ? `, ${firstName}` : ''}! Your details and documents have been sent to our HR team
          for review. You&rsquo;ll get full access to the portal as soon as they approve your onboarding.
        </p>

        <div className="mt-6 rounded-lg bg-gray-50 border border-gray-100 p-3 text-left">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> Profile &amp; documents submitted
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" /> Awaiting HR review &amp; approval
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={checkNow} loading={checking} loadingText="Checking&hellip;" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Check status
          </Button>
          <Button variant="ghost" onClick={logout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          This page checks for approval automatically every few seconds.
        </p>
      </div>
    </div>
  );
}
