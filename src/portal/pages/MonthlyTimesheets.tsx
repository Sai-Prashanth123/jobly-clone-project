import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthlyTimesheets } from '../hooks/useMonthlyTimesheets';
import { formatDate } from '../lib/utils';
import { monthLabel } from '../lib/monthUtils';
import type { MonthlyTimesheet } from '../types';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted (needs review)' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
];

export default function MonthlyTimesheets() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const { data, isLoading } = useMonthlyTimesheets(status === 'all' ? { limit: 200 } : { status, limit: 200 });
  const rows = data?.data ?? [];

  const columns: Column<MonthlyTimesheet>[] = [
    {
      key: 'displayId',
      header: 'ID',
      render: t => <span className="text-xs font-mono text-blue-600">{t.displayId ?? t.id.slice(0, 8)}</span>,
      getValue: t => t.displayId ?? '',
    },
    {
      key: 'employee',
      header: 'Employee',
      render: t => (
        <div className="min-w-0">
          <p className="font-medium truncate">{t.employeeName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{t.employeeDisplayId ?? ''}</p>
        </div>
      ),
      getValue: t => t.employeeName ?? '',
      sortable: true,
    },
    {
      key: 'period',
      header: 'Period',
      render: t => monthLabel(t.year, t.month),
      getValue: t => `${t.year}-${String(t.month).padStart(2, '0')}`,
      sortable: true,
    },
    {
      key: 'totalHours',
      header: 'Total Hours',
      hideOnMobile: true,
      render: t => <span className="tabular-nums">{Number(t.totalHours).toFixed(1)}</span>,
      getValue: t => String(t.totalHours),
      sortable: true,
    },
    {
      key: 'workingDays',
      header: 'Working Days',
      hideOnMobile: true,
      getValue: t => String(t.workingDays),
    },
    {
      key: 'status',
      header: 'Status',
      render: t => <StatusBadge status={t.status} />,
      getValue: t => t.status,
      sortable: true,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      hideOnMobile: true,
      render: t => formatDate(t.submittedAt),
      getValue: t => t.submittedAt ?? '',
      sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Attendance"
        title="Attendance Review"
        description={isLoading ? 'Loading…' : `${rows.length} monthly timesheet${rows.length === 1 ? '' : 's'}`}
        action={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by employee, ID, status…"
          searchKeys={['displayId', 'employeeName', 'employeeDisplayId', 'status']}
          getRowKey={t => t.id}
          onRowClick={t => navigate(`/portal/attendance/${t.id}`)}
          emptyTitle="No monthly timesheets"
          emptyDescription="Submitted attendance timesheets will appear here for review."
          exportFilename="monthly-timesheets"
        />
      )}
    </div>
  );
}
