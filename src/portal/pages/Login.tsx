import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { Briefcase, Eye, EyeOff } from 'lucide-react';

const DEMO_QUICK_FILL = [
  { role: 'Admin', email: 'admin@joblysolutions.com', password: 'Jbly#Adm!n2026' },
  { role: 'HR', email: 'hr@joblysolutions.com', password: 'Jbly#Hr!2026' },
  { role: 'Operations', email: 'ops@joblysolutions.com', password: 'Jbly#0ps!2026' },
  { role: 'Finance', email: 'finance@joblysolutions.com', password: 'Jbly#F!n2026' },
  { role: 'Employee', email: 'john.doe@joblysolutions.com', password: 'Jbly#Emp!2026' },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in
  if (isAuthenticated) {
    navigate(params.get('redirect') ?? '/portal/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = login(email, password);
    if (result.success) {
      navigate(params.get('redirect') ?? '/portal/dashboard', { replace: true });
    } else {
      setError(result.error ?? 'Login failed');
      setLoading(false);
    }
  };

  const quickFill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  return (
    <div className="portal-scope min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-3">
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jobly Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Workforce Management System</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@joblysolutions.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPw(p => !p)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Quick Fill */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Demo Accounts — Click to fill
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_QUICK_FILL.map(d => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => quickFill(d.email, d.password)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-sm transition-colors"
                >
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{d.role}</Badge>
                  <span className="text-gray-600">{d.email}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
