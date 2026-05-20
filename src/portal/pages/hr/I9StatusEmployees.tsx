import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useEmployees } from '../../hooks/useEmployees';
import { isI9Issue } from '../../lib/employeeSegments';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

export default function I9StatusEmployees() {
  const navigate = useNavigate();
  const { data, isLoading } = useEmployees({ limit: 500 });
  const employees = (data?.data ?? []).filter(isI9Issue);

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
      key: 'i9Status',
      header: 'I-9 Status',
      render: e => e.i9Status ? <StatusBadge status={e.i9Status} /> : <span className="text-xs text-muted-foreground italic">—</span>,
      getValue: e => e.i9Status ?? '',
      sortable: true,
    },
    {
      key: 'startDate',
      header: 'Hire Date',
      hideOnMobile: true,
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      getValue: e => e.department ?? '',
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <Link to="/portal/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
      </Link>
      <PageHeader
        eyebrow="HR · Compliance"
        title="I-9 Status"
        description={
          isLoading
            ? 'Loading…'
            : `${employees.length} employees have a pending or expired I-9. Open a profile to mark complete.`
        }
      />
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <div className="portal-glass-card p-12 text-center">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-900">All I-9s in good standing</p>
          <p className="text-sm text-gray-500 mt-1">No employees with a pending or expired I-9 right now.</p>
        </div>
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by name, ID, department…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'department', 'jobTitle']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No I-9 issues"
          exportFilename="i9-issues"
        />
      )}
    </div>
  );
}
