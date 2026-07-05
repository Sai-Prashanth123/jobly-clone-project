import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, RefreshCw, CheckCircle2, MessageSquareWarning, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';

// Shown after an employee submits self-onboarding OR after HR sends them back
// to revise something. We poll /auth/me so HR approval (or HR "request
// changes") moves the screen automatically. ProtectedRoute also redirects when
// onboardingStatus becomes 'approved'.
export default function OnboardingPending() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [reopening, setReopening] = useState(false);

  const isChangesRequested = user?.onboardingStatus === 'changes_requested';
  const hrMessage = user?.onboardingChangeRequestMessage ?? '';

  // Already approved (or not an onboarding employee)? Don't linger here.
  useEffect(() => {
    if (user?.role !== 'employee' || user?.onboardingStatus === 'approved') {
      navigate('/portal/dashboard', { replace: true });
    }
  }, [user?.onboardingStatus, user?.role, navigate]);

  // Poll for HR approval / change-request updates.
  useEffect(() => {
    const id = setInterval(() => { void refreshUser(); }, 5000);
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

  // "Update my information" — used when HR has requested changes. No backend
  // call needed; just navigate. The backend has already cleared
  // onboarding_completed_at via requestOnboardingChanges, so the gate will let
  // them onto the wizard.
  const goToWizard = () => navigate('/portal/onboarding');

  // "Change information" — self-initiated re-edit before HR has acted. Calls
  // the reopen endpoint to clear onboarding_completed_at, refreshes the
  // session, then navigates to the wizard.
  const reopenForEdit = async () => {
    if (!user?.employeeId) return;
    setReopening(true);
    try {
      await apiClient.post(`/employees/${user.employeeId}/onboarding/reopen`, {});
      await refreshUser();
      navigate('/portal/onboarding');
    } catch (err: any) {
      // Raw apiClient call, not a useMutation — the central toast handler in
      // queryClient.ts never sees this, so it needs its own toast.
      toast.error(err?.response?.data?.error ?? 'Could not reopen onboarding. Please try again.');
    } finally {
      setReopening(false);
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className="portal-scope min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div
          className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${
            isChangesRequested ? 'bg-amber-100' : 'bg-blue-100'
          }`}
        >
          {isChangesRequested ? (
            <MessageSquareWarning className="h-7 w-7 text-amber-600" />
          ) : (
            <Clock className="h-7 w-7 text-blue-600" />
          )}
        </div>

        {isChangesRequested ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900">HR requested changes</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              {firstName ? `Hi ${firstName} — ` : ''}HR has reviewed your onboarding and asked you to update a
              few things before they can approve.
            </p>
            <div className="mt-5 rounded-lg bg-amber-50 border border-amber-200 p-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Message from HR</p>
              <p className="mt-2 text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{hrMessage}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={goToWizard} className="gap-2">
                <Pencil className="h-4 w-4" /> Update my information
              </Button>
              <Button variant="ghost" onClick={logout} className="gap-2 text-muted-foreground">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
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
              <Button
                variant="outline"
                onClick={reopenForEdit}
                disabled={reopening}
                className="gap-2"
              >
                {reopening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                Change information
              </Button>
              <Button variant="ghost" onClick={logout} className="gap-2 text-muted-foreground">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>

            <p className="mt-4 text-[11px] text-gray-400">
              This page checks for approval automatically every few seconds.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
