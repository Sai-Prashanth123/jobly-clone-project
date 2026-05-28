import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { useAuth, useForgotPassword } from '../hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Eye, EyeOff, ArrowRight, Loader2, ArrowLeft,
  ShieldCheck, KeyRound, Sparkles,
} from 'lucide-react';

const ACCOUNTS = [
  { role: 'Admin',      email: 'admin@joblysolutions.com',   password: 'Jbly#Adm!n2026', color: '#4069FF' },
  { role: 'HR',         email: 'hr@joblysolutions.com',      password: 'Jbly#Hr!2026',   color: '#8B5CF6' },
  { role: 'Operations', email: 'ops@joblysolutions.com',     password: 'Jbly#0ps!2026',  color: '#F59E0B' },
  { role: 'Finance',    email: 'finance@joblysolutions.com', password: 'Jbly#F!n2026',   color: '#10B981' },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, color: 'text-emerald-400', title: 'SOC 2 ready', desc: 'Audit-grade controls' },
  { icon: KeyRound,    color: 'text-cyan-400',    title: 'SSO via Supabase', desc: 'OIDC, JWT, RLS' },
  { icon: Sparkles,    color: 'text-blue-400',    title: 'Real-time',   desc: 'Always in sync' },
];

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

  return (
    <div className="portal-scope auth-shell flex flex-col lg:flex-row">

      {/* ── LEFT — hero on the mesh ───────────────────────────── */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 px-12 xl:px-20 py-12 min-w-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/img/logo/logo-3.png"
            alt="Jobly Solutions"
            className="h-8 object-contain brightness-0 invert opacity-90"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <div className="max-w-xl">
          <p className="eyebrow !text-cyan-300/90 mb-5">Workforce Platform</p>
          <h1 className="display-xl text-white mb-6">
            Run your workforce.
            <br />
            <span className="text-[#32CDDC]">One calm room.</span>
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed max-w-md">
            Employees, clients, timesheets, approvals, and invoicing — engineered for staffing teams that want clarity, not clutter.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
            {TRUST_BADGES.map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm transition-colors hover:bg-white/[0.06] hover:border-white/15"
              >
                <Icon className={`h-4 w-4 ${color} flex-shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{title}</p>
                  <p className="text-[11px] text-white/55 mt-0.5 truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-white/40">© 2026 Jobly Solutions</p>
      </aside>

      {/* ── RIGHT — form card on the mesh ─────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12 lg:px-12 xl:px-16 w-full lg:max-w-[640px]">
        <div className="w-full max-w-[440px] mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to website
          </Link>
        </div>

        <div className="w-full max-w-[440px] auth-card p-7 sm:p-9 portal-animate-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-6 flex items-center">
            <img
              src="/assets/img/logo/logo-3.png"
              alt="Jobly"
              className="h-8 object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          <div className="mb-7">
            <h2 className="display-lg text-ink-900">Sign in</h2>
            <p className="text-[13px] text-slate-500 mt-1.5">Access your Jobly workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="eyebrow">Email address</Label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setActive(null); }}
                placeholder="you@joblysolutions.com"
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="eyebrow">Password</Label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-premium pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-400 hover:text-ink-800 hover:bg-slate-100 transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => { setFpEmail(email); setFpSent(false); setFpOpen(true); }}
                className="text-[12px] text-slate-500 hover:text-ink-800 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px] text-red-700 bg-red-50 border border-red-100"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-navy w-full mt-2"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                : <>Sign In<ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Demo accounts — role-tinted chips */}
          <div className="mt-9">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-slate-100" />
              <p className="eyebrow">Demo accounts</p>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNTS.map(a => {
                const isActive = active === a.role;
                return (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => quickFill(a)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium text-left transition-all min-h-[44px]"
                    style={{
                      background: isActive ? `${a.color}12` : '#fff',
                      color: isActive ? a.color : '#475569',
                      border: `1px solid ${isActive ? `${a.color}60` : '#e2e8f0'}`,
                      boxShadow: isActive ? `0 4px 14px ${a.color}28` : 'none',
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: `${a.color}18`, color: a.color }}
                    >
                      {a.role[0]}
                    </span>
                    <span className="truncate">{a.role}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-3">
              Click a role to auto-fill credentials, then sign in.
            </p>
          </div>
        </div>
      </main>

      {/* Forgot-password — emails a temporary password + forces a reset. Always
          shows the same generic confirmation (the backend never reveals whether
          the email exists). */}
      <Dialog open={fpOpen} onOpenChange={setFpOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your account email and we'll send reset instructions.
            </DialogDescription>
          </DialogHeader>
          {fpSent ? (
            <div className="py-1">
              <p className="text-sm text-slate-600 leading-relaxed">
                If an account exists for <strong>{fpEmail}</strong>, we've emailed reset
                instructions. Check your inbox (and spam) for a temporary password, then sign
                in — you'll be asked to set a new password.
              </p>
              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setFpOpen(false)} className="btn-navy">
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
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email address</Label>
                <input
                  id="fp-email"
                  type="email"
                  value={fpEmail}
                  required
                  onChange={e => setFpEmail(e.target.value)}
                  placeholder="you@joblysolutions.com"
                  className="input-premium"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFpOpen(false)} className="btn-navy-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={forgot.isPending} className="btn-navy">
                  {forgot.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    : 'Send instructions'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
