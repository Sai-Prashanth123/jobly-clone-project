import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useEmployees } from '../../hooks/useEmployees';
import { isOnboarding } from '../../lib/employeeSegments';
import { OnboardingBar } from '../../components/employees/OnboardingProgress';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

export default function OnboardingEmployees() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useEmployees({ limit: 500 });
  const employees = (data?.data ?? []).filter(isOnboarding);

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
      key: 'profile',
      header: 'Profile %',
      render: e => <OnboardingBar onboarding={e.onboarding} />,
      getValue: e => String(e.onboarding?.percent ?? 0),
      sortable: true,
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: e => formatDate(e.startDate),
      getValue: e => e.startDate ?? '',
      sortable: true,
    },
    { key: 'department', header: 'Department', hideOnMobile: true, getValue: e => e.department ?? '' },
    { key: 'jobTitle', header: 'Job Title', hideOnMobile: true },
    {
      key: 'i9Status',
      header: 'I-9',
      hideOnMobile: true,
      render: e => e.i9Status ? <StatusBadge status={e.i9Status} /> : <span className="text-xs text-muted-foreground italic">—</span>,
      getValue: e => e.i9Status ?? '',
    },
    {
      key: 'visa',
      header: 'Visa',
      hideOnMobile: true,
      render: e => e.visaType
        ? <span className="text-xs uppercase font-medium text-violet-700">{e.visaType}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      getValue: e => e.visaType ?? '',
    },
  ];

  return (
    <div>
      <Link to="/portal/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Back to Dashboard
      </Link>
      <PageHeader
        eyebrow="HR · Onboarding"
        title="Employees Onboarding"
        description={
          isLoading
            ? 'Loading…'
            : `${employees.length} new hires going through onboarding. Open a profile to approve onboarding once paperwork is complete.`
        }
        action={
          <Button onClick={() => navigate('/portal/employees?new=1')} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
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
      ) : (
        <DataTable
          data={employees}
          columns={columns}
          searchPlaceholder="Search by ID, name, email, department…"
          searchKeys={['displayId', 'firstName', 'lastName', 'email', 'department', 'jobTitle']}
          getRowKey={e => e.id}
          onRowClick={e => navigate(`/portal/employees/${e.id}`)}
          emptyTitle="No employees in onboarding"
          emptyDescription="Add a new employee to start an onboarding workflow."
          exportFilename="onboarding-employees"
        />
      )}
    </div>
  );
}
