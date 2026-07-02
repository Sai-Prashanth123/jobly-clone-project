import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { useEmployees } from '../../hooks/useEmployees';
import { isVisaExpiringSoon, daysUntilVisaExpiry } from '../../lib/employeeSegments';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

function expiryToneClass(days: number | null): string {
  if (days == null) return 'text-gray-500';
  if (days <= 14) return 'text-red-600 font-semibold';
  if (days <= 45) return 'text-amber-600 font-semibold';
  return 'text-gray-700';
}

export default function VisaExpiringEmployees() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useEmployees({ limit: 500 });
  const employees = (data?.data ?? []).filter(e => isVisaExpiringSoon(e));

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
      key: 'visaType',
      header: 'Visa',
      render: e => <span className="text-xs uppercase font-medium text-violet-700">{e.visaType ?? '—'}</span>,
      getValue: e => e.visaType ?? '',
    },
    {
      key: 'visaExpiry',
      header: 'Expiry',
      render: e => formatDate(e.visaExpiry),
      getValue: e => e.visaExpiry ?? '',
      sortable: true,
    },
    {
      key: 'daysRemaining',
      header: 'Days Remaining',
      render: e => {
        const d = daysUntilVisaExpiry(e);
        return (
          <span className={`text-sm tabular-nums ${expiryToneClass(d)}`}>
            {d == null ? '—' : `${d} day${d === 1 ? '' : 's'}`}
          </span>
        );
      },
      getValue: e => String(daysUntilVisaExpiry(e) ?? ''),
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      getValue: e => e.department ?? '',
    },
  ];

  return (
    <div>
      <Link to="/portal/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
      </Link>
      <PageHeader
        eyebrow="HR · Compliance"
        title="Visas Expiring Soon"
        description={
          isLoading
            ? 'Loading…'
            : `${employees.length} employees have a visa expiring within the next 90 days. Start renewal paperwork early.`
        }
      />
      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load employees. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <div className="portal-glass-card p-12 text-center">
          <AlertCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-900">All visas in good standing</p>
          <p className="text-sm text-gray-500 mt-1">No employee visas expire in the next 90 days.</p>
        </div>
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by name, ID, visa type…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'visaType']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No visas expiring soon"
          exportFilename="visa-expiring"
        />
      )}
    </div>
  );
}
