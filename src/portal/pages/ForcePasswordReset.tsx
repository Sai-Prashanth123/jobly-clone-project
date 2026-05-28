import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
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
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

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
    <div className="portal-scope min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-[420px] portal-animate-in">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-9">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#4069FF] to-[#32CDDC]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">Set your password</h1>
              <p className="text-[12px] text-gray-500">One-time step before you can continue</p>
            </div>
          </div>

          <p className="text-[13px] text-gray-600 leading-relaxed mb-6">
            You signed in with a temporary password{user?.email ? <> for <strong>{user.email}</strong></> : ''}.
            Choose a new password to finish setting up your account — you'll use it from now on.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fr-current">Temporary password</Label>
              <Input id="fr-current" type={show ? 'text' : 'password'} value={current}
                onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required
                placeholder="The password from your welcome email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-new">New password</Label>
              <div className="relative">
                <Input id="fr-new" type={show ? 'text' : 'password'} value={next}
                  onChange={e => setNext(e.target.value)} autoComplete="new-password" required className="pr-10"
                  placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-confirm">Confirm new password</Label>
              <Input id="fr-confirm" type={show ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>

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
