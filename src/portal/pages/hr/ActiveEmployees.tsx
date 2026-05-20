import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useEmployees } from '../../hooks/useEmployees';
import { isActive } from '../../lib/employeeSegments';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

export default function ActiveEmployees() {
  const navigate = useNavigate();
  const { data, isLoading } = useEmployees({ limit: 500 });
  const employees = (data?.data ?? []).filter(isActive);

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
    { key: 'department', header: 'Department', hideOnMobile: true, getValue: e => e.department ?? '', sortable: true },
    { key: 'jobTitle', header: 'Job Title', hideOnMobile: true },
    {
      key: 'startDate',
      header: 'Start Date',
      hideOnMobile: true,
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: e => <StatusBadge status={e.status} />,
      getValue: e => e.status,
    },
  ];

  return (
    <div>
      <Link to="/portal/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
      </Link>
      <PageHeader
        eyebrow="HR · Workforce"
        title="Active Employees"
        description={
          isLoading
            ? 'Loading…'
            : `${employees.length} employees currently on payroll. Click any row to open their profile.`
        }
      />
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by ID, name, email, department, title…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'department', 'jobTitle']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No active employees"
          emptyDescription="Once employees move from onboarding to active, they'll show up here."
          exportFilename="active-employees"
        />
      )}
      {employees.length === 0 && !isLoading && (
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Users className="h-4 w-4 inline mr-1" />
          Tip: Move an employee from onboarding → active via their detail page.
        </div>
      )}
    </div>
  );
}
