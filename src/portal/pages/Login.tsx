import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

const ACCOUNTS = [
  { role: 'Admin',      email: 'admin@joblysolutions.com',   password: 'Jbly#Adm!n2026', color: '#4069FF' },
  { role: 'HR',         email: 'hr@joblysolutions.com',      password: 'Jbly#Hr!2026',   color: '#8B5CF6' },
  { role: 'Operations', email: 'ops@joblysolutions.com',     password: 'Jbly#0ps!2026',  color: '#F59E0B' },
  { role: 'Finance',    email: 'finance@joblysolutions.com', password: 'Jbly#F!n2026',   color: '#10B981' },
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

  if (isAuthenticated) {
    return <Navigate to={params.get('redirect') ?? '/portal/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate(params.get('redirect') ?? '/portal/dashboard', { replace: true });
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
    <div className="portal-scope min-h-screen flex">

      {/* ── Left — minimal brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[44%] px-14 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f2460 55%, #0d3b6e 100%)' }}
      >
        {/* Subtle glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-10%', right: '-20%',
            width: 560, height: 560, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(50,205,220,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '20%', left: '-20%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(64,105,255,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <img
            src="/assets/img/logo/logo-3.png"
            alt="Jobly Solutions"
            className="h-9 object-contain brightness-0 invert opacity-90"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Centre copy */}
        <div className="relative z-10">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-cyan-300/90 mb-5">
            Workforce Platform
          </p>
          <h1 className="text-[2rem] xl:text-[2.5rem] font-semibold text-white leading-[1.1] tracking-tight mb-6">
            Manage your <span style={{ color: '#32CDDC' }}>entire team</span> from one place.
          </h1>
          <p className="text-[13px] text-slate-400 leading-relaxed max-w-[300px]">
            Employees, clients, timesheets, approvals, and invoicing — streamlined for staffing agencies.
          </p>

          {/* Inline trust strip */}
          <div className="mt-10 flex items-center gap-6 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              SOC&nbsp;2 ready
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              SSO via Supabase
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-slate-600">© 2026 Jobly Solutions</p>
        </div>
      </div>

      {/* ── Right — form panel ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12 lg:px-20"
        style={{ background: '#ffffff' }}
      >
        {/* Back link */}
        <div className="w-full max-w-[400px] mb-6 sm:mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#4069FF] transition-colors group"
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
            <h2 className="text-[1.65rem] font-semibold text-gray-900 tracking-tight">Sign in</h2>
            <p className="text-[13px] text-gray-500 mt-1.5">Access your Jobly workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
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
                className="h-12 rounded-xl text-sm border-gray-200 bg-gray-50 focus:bg-white focus:border-[#4069FF] focus:ring-2 focus:ring-[#4069FF]/10 transition-all placeholder:text-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
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
                  className="h-12 rounded-xl text-sm pr-11 border-gray-200 bg-gray-50 focus:bg-white focus:border-[#4069FF] focus:ring-2 focus:ring-[#4069FF]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-red-600"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="portal-btn-gradient w-full h-12 rounded-xl font-semibold text-[13px] text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: '0 4px 24px rgba(64,105,255,0.28)', marginTop: '8px' }}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                : <><span>Sign In</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Account switcher — demo helper, kept understated */}
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-gray-100" />
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.16em] font-semibold">
                Demo accounts
              </p>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCOUNTS.map(a => {
                const isActive = active === a.role;
                return (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => quickFill(a)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium text-left transition-colors"
                    style={{
                      background: isActive ? `${a.color}10` : '#fafafa',
                      color: isActive ? a.color : '#475569',
                      border: `1px solid ${isActive ? `${a.color}55` : '#e5e7eb'}`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: a.color }}
                    />
                    {a.role}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              Click a role to auto-fill credentials, then sign in.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
