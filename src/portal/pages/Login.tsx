import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useForgotPassword } from '../hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Eye, EyeOff, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { AuroraBackground } from '@/components/ui/aurora-background';

const ACCOUNTS = [
  { role: 'Admin',      email: 'admin@joblysolutions.com',   password: 'Jbly#Adm!n2026', color: '#4069FF' },
  { role: 'HR',         email: 'hr@joblysolutions.com',      password: 'Jbly#Hr!2026',   color: '#8B5CF6' },
  { role: 'Operations', email: 'ops@joblysolutions.com',     password: 'Jbly#0ps!2026',  color: '#F59E0B' },
  { role: 'Finance',    email: 'finance@joblysolutions.com', password: 'Jbly#F!n2026',   color: '#10B981' },
  { role: 'Legal',      email: 'legal@joblysolutions.com',   password: 'Jbly#Lgl!2026',  color: '#E11D48' },
];

// ── Clean × Elegant tokens — minimal, delicate type, generous whitespace ──
const TEXT = '#111827';     // near-black headings/text
const BRAND = '#4069FF';    // Jobly blue accent

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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

  if (isAuthenticated) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/portal/dashboard', { replace: true });
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

  // Elegant input — white, hairline border, gentle blue focus ring, smooth transition.
  const inputCls =
    'h-12 rounded-xl text-sm bg-white border border-gray-200 px-4 transition-all duration-200 ' +
    'placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-offset-0 ' +
    'focus-visible:ring-[#4069FF]/15 focus-visible:border-[#4069FF]';

  return (
    <div className="portal-scope min-h-screen lg:h-screen lg:overflow-hidden flex bg-white">

      {/* ── Left — animated Aurora brand panel (separates the halves) ── */}
      <AuroraBackground
        showRadialGradient
        style={{ background: 'linear-gradient(160deg, #e9eeff 0%, #eef0fb 46%, #f2edfb 100%)' }}
        className="hidden lg:flex flex-col justify-between items-stretch w-[44%] px-16 py-16 text-slate-950 border-r border-slate-200/80"
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

        {/* Centre copy — delicate type, generous whitespace */}
        <div className="relative z-10 max-w-[420px]">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-6" style={{ color: BRAND }}>
            Workforce Platform
          </p>
          <h1 className="text-[2.4rem] xl:text-[2.75rem] font-semibold leading-[1.14] tracking-[-0.02em] mb-7" style={{ color: TEXT }}>
            Manage your <span style={{ color: BRAND }}>entire&nbsp;team</span> from one place.
          </h1>
          <p className="text-[15px] font-normal text-gray-600 leading-[1.7]">
            Employees, clients, timesheets, approvals, and invoicing — streamlined for staffing agencies.
          </p>

          {/* Trust line — minimal */}
          <div className="mt-10 flex items-center gap-8 text-[12.5px] text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> SOC&nbsp;2 ready
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} /> SSO via Supabase
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-gray-500">© 2026 Jobly Solutions</p>
        </div>
      </AuroraBackground>

      {/* ── Right — form panel (white) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 lg:px-24 bg-white lg:h-screen lg:overflow-y-auto">
        {/* Back link */}
        <div className="w-full max-w-[384px] mb-8 sm:mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-[#4069FF] transition-all duration-200 group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back to website
          </Link>
        </div>

        <div className="w-full max-w-[384px] portal-animate-in">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src="/assets/img/logo/logo-3.png" alt="Jobly" className="h-8 object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[1.85rem] font-semibold tracking-[-0.01em]" style={{ color: TEXT }}>Sign in</h2>
            <p className="text-[14px] font-normal text-gray-500 mt-2.5">Access your Jobly workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-gray-700">
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

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium text-gray-700">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => { setFpEmail(email); setFpSent(false); setFpOpen(true); }}
                  className="text-[12px] text-gray-400 hover:text-[#4069FF] transition-all duration-200"
                >
                  Forgot password?
                </button>
              </div>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-red-600 border border-red-200 bg-red-50">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-medium text-[14px] text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              style={{ background: BRAND }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#3257e0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = BRAND; }}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Account switcher — minimal demo chips */}
          <div className="mt-9">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px flex-1 bg-gray-100" />
              <p className="text-[11px] text-gray-400 uppercase tracking-[0.14em] font-medium">
                Demo accounts
              </p>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCOUNTS.map(a => {
                const isActive = active === a.role;
                return (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => quickFill(a)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] font-medium text-left border transition-all duration-200"
                    style={{
                      borderColor: isActive ? BRAND : '#E5E7EB',
                      background: isActive ? 'rgba(64,105,255,0.05)' : '#ffffff',
                      color: isActive ? BRAND : '#374151',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    {a.role}
                  </button>
                );
              })}
            </div>
            <p className="text-[12px] text-gray-400 text-center mt-4">
              Click a role to auto-fill credentials, then sign in.
            </p>
          </div>

        </div>
      </div>

      {/* Forgot-password — emails a temporary password + forces a reset. Always
          shows the same generic confirmation (the backend never reveals whether
          the email exists). */}
      <Dialog open={fpOpen} onOpenChange={setFpOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: TEXT }}>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your personal or work email and we'll send reset instructions.
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
                  className="px-5 h-10 rounded-xl text-[13px] font-medium text-white transition-all duration-200"
                  style={{ background: BRAND }}
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
              <div className="space-y-2.5">
                <Label htmlFor="fp-email" className="text-[13px] font-medium text-gray-700">Email address</Label>
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
                  className="px-4 h-10 rounded-xl text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgot.isPending}
                  className="px-5 h-10 rounded-xl text-[13px] font-medium text-white flex items-center gap-2 disabled:opacity-50 transition-all duration-200"
                  style={{ background: BRAND }}
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
