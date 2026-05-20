import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import type { Employee } from '../types';

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useEmployees({ limit: 100 });
  const canManage = user?.role === 'admin' || user?.role === 'hr';
  const [searchParams, setSearchParams] = useSearchParams();

  // Backward-compat: ?new=1 used to open an inline modal. The create flow is
  // now a dedicated page — redirect there and clean the query string so the
  // legacy HRDashboard link still works.
  useEffect(() => {
    if (canManage && searchParams.get('new') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
      navigate('/portal/employees/new', { replace: true });
    }
  }, [canManage, searchParams, setSearchParams, navigate]);

  const employees = data?.data ?? [];

  const columns: Column<Employee>[] = [
    {
      key: 'id',
      header: 'ID',
      render: e => <span className="text-xs font-mono text-blue-600">{e.displayId ?? e.id.slice(0, 8)}</span>,
      getValue: e => e.displayId ?? e.id.slice(0, 8),
    },
    {
      key: 'name',
      header: 'Name',
      render: e => (
        <div>
          <p className="font-medium">{e.firstName} {e.lastName}</p>
          <p className="text-xs text-muted-foreground">{e.email}</p>
        </div>
      ),
      getValue: e => `${e.firstName} ${e.lastName}`,
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      getValue: e => e.department ?? '',
      sortable: true,
    },
    { key: 'jobTitle', header: 'Job Title', hideOnMobile: true },
    {
      key: 'employmentType',
      header: 'Type',
      hideOnMobile: true,
      render: e => <span className="uppercase text-xs font-medium">{e.employmentType}</span>,
      getValue: e => e.employmentType ?? '',
    },
    {
      key: 'startDate',
      header: 'Start Date',
      hideOnMobile: true,
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: e => <StatusBadge status={e.status} />,
      getValue: e => e.status,
      sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description={isLoading ? 'Loading...' : `${employees.length} total employees`}
        action={canManage ? (
          <Button asChild className="gap-2">
            <Link to="/portal/employees/new">
              <UserPlus className="h-4 w-4" />
              Add Employee
            </Link>
          </Button>
        ) : undefined}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by ID, name, email, department, title, status…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'department', 'jobTitle', 'employmentType', 'status']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No employees found"
          emptyDescription="Add your first employee to get started."
          exportFilename="employees"
        />
      )}
    </div>
  );
}
