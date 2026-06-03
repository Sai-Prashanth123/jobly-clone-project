import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useForgotPassword } from '../hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Eye, EyeOff, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

const ACCOUNTS = [
  { role: 'Admin',      email: 'admin@joblysolutions.com',   password: 'Jbly#Adm!n2026', color: '#4069FF' },
  { role: 'HR',         email: 'hr@joblysolutions.com',      password: 'Jbly#Hr!2026',   color: '#8B5CF6' },
  { role: 'Operations', email: 'ops@joblysolutions.com',     password: 'Jbly#0ps!2026',  color: '#F59E0B' },
  { role: 'Finance',    email: 'finance@joblysolutions.com', password: 'Jbly#F!n2026',   color: '#10B981' },
];

// ── Paper × Neobrutalism tokens ──
const INK = '#0F172A';      // chunky border + hard-shadow ink (near-black slate)
const BRAND = '#4069FF';    // Jobly blue
const TEAL = '#32CDDC';     // Jobly teal accent
// Faint dot-grid texture (Paper + Neobrutalism) for the brand panel.
const DOT_GRID: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: 'radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};
// Neobrutalist primary button (chunky border + hard offset shadow that "presses").
const NB_BTN =
  'rounded-xl font-extrabold text-white bg-[#4069FF] border-2 border-[#0F172A] shadow-[3px_3px_0_#0F172A] ' +
  'hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#0F172A] ' +
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [active, setActive]     = useState<string | null>(null);

  const forgot = useForgotPassword();
  const [fpOpen, setFpOpen]     = useState(false);
  const [fpEmail, setFpEmail]   = useState('');
  const [fpSent, setFpSent]     = useState(false);

  // Only honour redirects to in-portal paths to prevent open-redirect to external sites.
  const safeRedirect = (() => {
    const raw = params.get('redirect');
    return raw && raw.startsWith('/portal/') ? raw : '/portal/dashboard';
  })();

  if (isAuthenticated) {
    return <Navigate to={safeRedirect} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate(safeRedirect, { replace: true });
    } else {
      setError(result.error ?? 'Invalid credentials. Please try again.');
      setLoading(false);
    }
  };

  const quickFill = (a: typeof ACCOUNTS[0]) => {
    setEmail(a.email);
    setPassword(a.password);
    setError('');
    setActive(a.role);
  };

  // Shared input styling — white field, chunky ink border, brand-blue hard focus shadow.
  const inputCls =
    'h-12 rounded-xl text-sm bg-white border-2 border-[#0F172A] px-3.5 transition-all ' +
    'placeholder:text-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 ' +
    'focus:border-[#4069FF] focus:shadow-[3px_3px_0_#4069FF]';

  return (
    <div className="portal-scope min-h-screen flex bg-white">

      {/* ── Left — white neobrutalist brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[44%] px-14 py-12 relative overflow-hidden border-r-2 border-[#0F172A]"
        style={DOT_GRID}
      >
        {/* Logo */}
        <div className="relative z-10">
          <img
            src="/assets/img/logo/logo-3.png"
            alt="Jobly Solutions"
            className="h-9 object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Centre copy — chunky bordered paper card */}
        <div className="relative z-10 bg-white border-2 border-[#0F172A] rounded-2xl shadow-[7px_7px_0_#0F172A] p-8 max-w-[440px]">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase mb-4" style={{ color: BRAND }}>
            Workforce Platform
          </p>
          <h1 className="text-[2.1rem] xl:text-[2.5rem] font-black leading-[1.08] tracking-tight mb-5" style={{ color: INK }}>
            Manage your <span style={{ color: TEAL }}>entire team</span> from one place.
          </h1>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
            Employees, clients, timesheets, approvals, and invoicing — streamlined for staffing agencies.
          </p>

          {/* Trust badges — neobrutalist chips */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 bg-white border-2 border-[#0F172A] rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-[2px_2px_0_#0F172A]" style={{ color: INK }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} /> SOC&nbsp;2 ready
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white border-2 border-[#0F172A] rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-[2px_2px_0_#0F172A]" style={{ color: INK }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} /> SSO via Supabase
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-slate-400 font-medium">© 2026 Jobly Solutions</p>
        </div>
      </div>

      {/* ── Right — form panel (clean white) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12 lg:px-20 bg-white">
        {/* Back link */}
        <div className="w-full max-w-[400px] mb-6 sm:mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#4069FF] transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to website
          </Link>
        </div>

        <div className="w-full max-w-[400px] portal-animate-in">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src="/assets/img/logo/logo-3.png" alt="Jobly" className="h-8 object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Heading */}
          <div className="mb-9">
            <h2 className="text-[1.8rem] font-black tracking-tight" style={{ color: INK }}>Sign in</h2>
            <p className="text-[13px] text-slate-500 mt-1.5">Access your Jobly workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#64748B' }}>
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setActive(null); }}
                placeholder="you@joblysolutions.com"
                required
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#64748B' }}>
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A] transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => { setFpEmail(email); setFpSent(false); setFpOpen(true); }}
                className="text-[12px] font-semibold text-slate-400 hover:text-[#4069FF] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border-2 shadow-[3px_3px_0_#DC2626]"
                style={{ background: '#FEF2F2', borderColor: '#DC2626', color: '#B91C1C' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-extrabold text-[13px] text-white bg-[#4069FF] border-2 border-[#0F172A] flex items-center justify-center gap-2 shadow-[4px_4px_0_#0F172A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#0F172A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0_#0F172A]"
              style={{ marginTop: '8px' }}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                : <><span>Sign In</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Account switcher — neobrutalist demo chips */}
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-0.5 flex-1" style={{ background: 'rgba(15,23,42,0.12)' }} />
              <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold" style={{ color: 'rgba(15,23,42,0.55)' }}>
                Demo accounts
              </p>
              <span className="h-0.5 flex-1" style={{ background: 'rgba(15,23,42,0.12)' }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACCOUNTS.map(a => {
                const isActive = active === a.role;
                return (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => quickFill(a)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-bold text-left border-2 bg-white shadow-[2px_2px_0_#0F172A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0F172A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                    style={{
                      borderColor: isActive ? a.color : INK,
                      background: isActive ? `${a.color}14` : '#ffffff',
                      color: isActive ? a.color : INK,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    {a.role}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-3.5">
              Click a role to auto-fill credentials, then sign in.
            </p>
          </div>

        </div>
      </div>

      {/* Forgot-password — emails a temporary password + forces a reset. Always
          shows the same generic confirmation (the backend never reveals whether
          the email exists). */}
      <Dialog open={fpOpen} onOpenChange={setFpOpen}>
        <DialogContent className="w-[95vw] max-w-md border-2 border-[#0F172A] rounded-2xl shadow-[6px_6px_0_#0F172A]">
          <DialogHeader>
            <DialogTitle className="font-black" style={{ color: INK }}>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your account email and we'll send reset instructions.
            </DialogDescription>
          </DialogHeader>
          {fpSent ? (
            <div className="py-1">
              <p className="text-sm text-gray-600 leading-relaxed">
                If an account exists for <strong>{fpEmail}</strong>, we've emailed reset
                instructions. Check your inbox (and spam) for a temporary password, then sign
                in — you'll be asked to set a new password.
              </p>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setFpOpen(false)}
                  className={`${NB_BTN} px-4 h-10 text-[13px]`}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try { await forgot.mutateAsync(fpEmail.trim()); } catch { /* response is generic regardless */ }
                setFpSent(true);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">Email address</Label>
                <Input
                  id="fp-email"
                  type="email"
                  value={fpEmail}
                  required
                  onChange={e => setFpEmail(e.target.value)}
                  placeholder="you@joblysolutions.com"
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFpOpen(false)}
                  className="px-4 h-10 rounded-lg text-[13px] font-bold text-slate-500 hover:text-[#0F172A] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgot.isPending}
                  className={`${NB_BTN} px-4 h-10 text-[13px] flex items-center gap-2`}
                >
                  {forgot.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send instructions'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
