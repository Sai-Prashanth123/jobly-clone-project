import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useChangePassword } from '../hooks/useAuth';

// A password input with its own independent show/hide toggle. Each of the three
// fields gets one so the user can reveal them separately.
function PasswordField({
  id, label, value, onChange, autoComplete, placeholder, autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className="pr-10"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// Full-screen, no-sidebar gate shown when a user is still on a one-time temporary
// password. They cannot reach anything else until they set their own password
// (enforced by the ProtectedRoute redirect + the backend 403 gate).
export default function ForcePasswordReset() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const change = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (next.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setErr('New password and confirmation do not match.'); return; }
    if (next === current) { setErr('New password must be different from the temporary password.'); return; }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      // Supabase admin password update REVOKES the user's existing access token.
      // Re-login with the new password BEFORE any other API call — otherwise the
      // 401 from the stale token bounces us to /portal/login and forces the user
      // to enter the password a second time. login() writes a fresh session +
      // pulls /me, which reflects the must_reset_password=false the server just
      // set, so ProtectedRoute can route them straight to onboarding.
      const reauth = await login(user!.email, next);
      if (!reauth.success) {
        setErr(reauth.error ?? 'Password set, but auto-login failed. Please sign in again.');
        return;
      }
      toast.success('Password set — welcome to Jobly!');
      navigate('/portal/onboarding', { replace: true });
    } catch (e2: unknown) {
      const msg = (e2 as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Could not set your password. Please try again.');
    }
  };

  return (
    <div className="portal-scope min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-[440px] portal-animate-in">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-9">
          {/* Header — centered icon + title so the layout stays balanced and the
              title never wraps awkwardly. `!text-2xl` beats the portal-scope h1
              reset (which would otherwise revert h1 to a huge UA default). */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#4069FF] to-[#32CDDC] shadow-sm mb-3">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h1 className="!text-2xl font-bold text-gray-900 leading-tight tracking-tight">Set your password</h1>
            <p className="text-[12px] text-gray-500 mt-1">One-time step before you can continue</p>
          </div>

          <p className="text-[13px] text-gray-600 leading-relaxed mb-6 text-center">
            You signed in with a temporary password{user?.email ? <> for <strong className="text-gray-800">{user.email}</strong></> : ''}.
            Choose a new password to finish setting up your account — you'll use it from now on.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <PasswordField
              id="fr-current"
              label="Temporary password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              placeholder="The password from your welcome email"
              autoFocus
            />
            <PasswordField
              id="fr-new"
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <PasswordField
              id="fr-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
            />

            {err && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm text-red-600 bg-red-50 border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {err}
              </div>
            )}

            <button type="submit" disabled={change.isPending}
              className="portal-btn-gradient w-full h-11 rounded-xl font-semibold text-[13px] text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 4px 24px rgba(64,105,255,0.28)' }}>
              {change.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting password…</> : 'Set password & continue'}
            </button>
          </form>

          <button type="button" onClick={logout}
            className="mt-5 w-full inline-flex items-center justify-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
