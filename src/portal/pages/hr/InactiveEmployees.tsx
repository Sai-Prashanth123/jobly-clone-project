import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useEmployees } from '../../hooks/useEmployees';
import { isInactive } from '../../lib/employeeSegments';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

export default function InactiveEmployees() {
  const navigate = useNavigate();
  const { data, isLoading } = useEmployees({ limit: 500 });
  const employees = (data?.data ?? []).filter(isInactive);

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
    { key: 'department', header: 'Department', hideOnMobile: true, getValue: e => e.department ?? '' },
    { key: 'jobTitle', header: 'Job Title', hideOnMobile: true },
    {
      key: 'startDate',
      header: 'Hire Date',
      hideOnMobile: true,
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
      sortable: true,
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      hideOnMobile: true,
      render: e => formatDate(e.updatedAt),
      getValue: e => e.updatedAt ?? '',
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
        title="Inactive Employees"
        description={
          isLoading
            ? 'Loading…'
            : `${employees.length} employees currently off-boarded or on hold. Open a profile to reactivate.`
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
          searchPlaceholder="Search by ID, name, email, department…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'department', 'jobTitle']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No inactive employees"
          emptyDescription="Everyone is currently active or onboarding."
          exportFilename="inactive-employees"
        />
      )}
    </div>
  );
}
