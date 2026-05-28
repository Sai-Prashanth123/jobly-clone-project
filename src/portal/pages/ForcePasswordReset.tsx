import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useChangePassword } from '../hooks/useAuth';

// Full-screen, no-sidebar gate shown when a user is still on a one-time temporary
// password. They cannot reach anything else until they set their own password
// (enforced by the ProtectedRoute redirect + the backend 403 gate).
export default function ForcePasswordReset() {
  const { user, logout, markPasswordResetComplete } = useAuth();
  const navigate = useNavigate();
  const change = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow]       = useState(false);
  const [err, setErr]         = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (next.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setErr('New password and confirmation do not match.'); return; }
    if (next === current) { setErr('New password must be different from the temporary password.'); return; }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      markPasswordResetComplete();
      toast.success('Password set — welcome to Jobly!');
      navigate('/portal/dashboard', { replace: true });
    } catch (e2: unknown) {
      const msg = (e2 as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Could not set your password. Please try again.');
    }
  };

  return (
    <div className="portal-scope auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] portal-animate-in">
        <div className="auth-card p-7 sm:p-9">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-ink-800 to-ink-700 shadow-md shadow-ink-800/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold text-ink-900 leading-tight tracking-tight">Set your password</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">One-time step before you can continue</p>
            </div>
          </div>

          <p className="text-[13px] text-slate-600 leading-relaxed mb-6">
            You signed in with a temporary password{user?.email ? <> for <strong className="text-ink-900">{user.email}</strong></> : ''}.
            Choose a new password to finish setting up your account — you&rsquo;ll use it from now on.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fr-current" className="eyebrow">Temporary password</Label>
              <input
                id="fr-current"
                type={show ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="The password from your welcome email"
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fr-new" className="eyebrow">New password</Label>
              <div className="relative">
                <input
                  id="fr-new"
                  type={show ? 'text' : 'password'}
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="At least 8 characters"
                  className="input-premium pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-400 hover:text-ink-800 hover:bg-slate-100 transition-colors"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fr-confirm" className="eyebrow">Confirm new password</Label>
              <input
                id="fr-confirm"
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className="input-premium"
              />
            </div>

            {err && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px] text-red-700 bg-red-50 border border-red-100"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <span className="leading-relaxed">{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={change.isPending}
              className="btn-navy w-full mt-2"
            >
              {change.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting password…</>
                : 'Set password & continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={logout}
            className="mt-5 w-full inline-flex items-center justify-center gap-1.5 text-[12px] text-slate-400 hover:text-ink-800 transition-colors min-h-[44px]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
