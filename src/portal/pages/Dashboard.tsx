import { useAuth } from '../hooks/useAuth';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { HRDashboard } from './dashboards/HRDashboard';
import { OperationsDashboard } from './dashboards/OperationsDashboard';
import { FinanceDashboard } from './dashboards/FinanceDashboard';
import { EmployeeDashboard } from './dashboards/EmployeeDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'hr':
      return <HRDashboard />;
    case 'operations':
      return <OperationsDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'employee':
      return <EmployeeDashboard />;
    default:
      return <AdminDashboard />;
  }
}
