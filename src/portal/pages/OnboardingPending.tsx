import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
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
    <div className="portal-scope auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] portal-animate-in">
        <div className="auth-card p-8 sm:p-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="text-[20px] font-semibold text-ink-900 tracking-tight">Onboarding submitted</h1>
          <p className="mt-2 text-[13.5px] text-slate-500 leading-relaxed">
            Thanks{firstName ? `, ${firstName}` : ''}! Your details and documents have been sent to
            our HR team for review. You&rsquo;ll get full access to the portal as soon as they approve
            your onboarding.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2.5 text-[12.5px] text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>Profile &amp; documents submitted</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12.5px] text-slate-700">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span>Awaiting HR review &amp; approval</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button type="button" onClick={checkNow} disabled={checking} className="btn-navy w-full">
              {checking
                ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</>
                : <><RefreshCw className="h-4 w-4" /> Check status</>}
            </button>
            <button type="button" onClick={logout} className="btn-navy-ghost w-full">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>

          <p className="mt-5 text-[11px] text-slate-400">
            This page checks for approval automatically every few seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
