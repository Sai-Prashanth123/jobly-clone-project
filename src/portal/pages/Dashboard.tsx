import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Lazy-load each role-specific dashboard so a user only downloads their own.
// Named exports get re-exported as default to satisfy React.lazy.
const AdminDashboard = lazy(() =>
  import('./dashboards/AdminDashboard').then(m => ({ default: m.AdminDashboard })),
);
const HRDashboard = lazy(() =>
  import('./dashboards/HRDashboard').then(m => ({ default: m.HRDashboard })),
);
const OperationsDashboard = lazy(() =>
  import('./dashboards/OperationsDashboard').then(m => ({ default: m.OperationsDashboard })),
);
const FinanceDashboard = lazy(() =>
  import('./dashboards/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })),
);
const EmployeeDashboard = lazy(() =>
  import('./dashboards/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })),
);

function DashboardFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  const content = (() => {
    switch (user.role) {
      case 'admin':      return <AdminDashboard />;
      case 'hr':         return <HRDashboard />;
      case 'operations': return <OperationsDashboard />;
      case 'finance':    return <FinanceDashboard />;
      case 'employee':   return <EmployeeDashboard />;
      default:           return <AdminDashboard />;
    }
  })();

  return <Suspense fallback={<DashboardFallback />}>{content}</Suspense>;
}
