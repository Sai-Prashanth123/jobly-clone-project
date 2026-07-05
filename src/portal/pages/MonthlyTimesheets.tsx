import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileCheck2, CalendarOff, AlertCircle, HelpCircle, UserX } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMonthlyTimesheets, useNotSubmittedEmployees } from '../hooks/useMonthlyTimesheets';
import { formatDate } from '../lib/utils';
import { monthLabel, currentMonth } from '../lib/monthUtils';
import type { MonthlyTimesheet, NotSubmittedEmployee } from '../types';

const LEAVE_REASON_LABELS: Record<string, string> = {
  medical_leave: 'Medical leave', sick: 'Sick', vacation: 'Vacation',
  unpaid_leave: 'Unpaid leave', bereavement: 'Bereavement', jury_duty: 'Jury duty', other: 'Other',
};

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
  const { data, isLoading, isError, refetch } = useMonthlyTimesheets(status === 'all' ? { limit: 200 } : { status, limit: 200 });
  const rows = data?.data ?? [];

  // "Not Submitted" tab: active employees with no monthly_timesheets row yet for the current period.
  const { year: notSubmittedYear, month: notSubmittedMonth } = currentMonth();
  const { data: notSubmittedRows = [], isLoading: isNotSubmittedLoading } = useNotSubmittedEmployees(notSubmittedYear, notSubmittedMonth);

  // Split the queue: timesheets with logged hours go to Client Timesheets tab
  // (client proof review); timesheets with ONLY leave days (no hours) go to
  // Leave Approval tab. Mixed months (hours + leave) show under Client Timesheets
  // so the reviewer can still check the client-signed proof.
  const workRows = rows.filter(t => Number(t.totalHours) > 0);
  const leaveRows = rows.filter(t => Number(t.totalHours) === 0 && (t.leaveDays ?? 0) > 0);
  const ghostRows = rows.filter(t => Number(t.totalHours) === 0 && (t.leaveDays ?? 0) === 0);

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

  // Client Timesheets tab adds a "Proof" column (client-signed upload present?).
  const clientColumns: Column<MonthlyTimesheet>[] = [
    ...columns.slice(0, 5), // ID, employee, period, total hours, working days
    {
      key: 'proof',
      header: 'Client Proof',
      render: t => t.clientSignedUrl
        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><FileCheck2 className="h-3.5 w-3.5" /> Uploaded</span>
        : <span className="text-xs text-amber-600">Missing</span>,
      getValue: t => (t.clientSignedUrl ? 'uploaded' : 'missing'),
    },
    columns[5], // status
    columns[6], // submitted
  ];

  // Leave Approval tab swaps in leave-specific columns.
  const leaveColumns: Column<MonthlyTimesheet>[] = [
    ...columns.slice(0, 3), // ID, employee, period
    {
      key: 'leaveDays',
      header: 'Leave Days',
      render: t => <span className="tabular-nums">{t.leaveDays ?? 0}</span>,
      getValue: t => String(t.leaveDays ?? 0),
      sortable: true,
    },
    {
      key: 'leaveReason',
      header: 'Reason',
      render: t => t.leaveReason ? (LEAVE_REASON_LABELS[t.leaveReason] ?? t.leaveReason) : '—',
      getValue: t => t.leaveReason ?? '',
    },
    columns[5], // status
    columns[6], // submitted
  ];

  // Not Submitted tab — active employees with no timesheet row at all for the period.
  const notSubmittedColumns: Column<NotSubmittedEmployee>[] = [
    {
      key: 'displayId',
      header: 'ID',
      render: e => <span className="text-xs font-mono text-blue-600">{e.displayId ?? e.id.slice(0, 8)}</span>,
      getValue: e => e.displayId ?? '',
    },
    {
      key: 'name',
      header: 'Employee',
      render: e => <span className="font-medium truncate">{`${e.firstName} ${e.lastName}`.trim()}</span>,
      getValue: e => `${e.firstName} ${e.lastName}`.trim(),
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      render: e => e.department ?? '—',
      getValue: e => e.department ?? '',
      sortable: true,
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      hideOnMobile: true,
      render: e => e.jobTitle ?? '—',
      getValue: e => e.jobTitle ?? '',
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
        onRefresh={refetch}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load timesheets. Please refresh.</p>
        </div>
      ) : (
        <Tabs defaultValue="client" className="mt-2">
          <TabsList className="mb-4 grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="client" className="gap-1.5"><FileCheck2 className="h-4 w-4" /> Client Timesheets ({workRows.length})</TabsTrigger>
            <TabsTrigger value="leave" className="gap-1.5"><CalendarOff className="h-4 w-4" /> Leave Approval ({leaveRows.length})</TabsTrigger>
            <TabsTrigger value="ghost" className="gap-1.5"><HelpCircle className="h-4 w-4" /> Needs Clarification ({ghostRows.length})</TabsTrigger>
            <TabsTrigger value="not-submitted" className="gap-1.5"><UserX className="h-4 w-4" /> Not Submitted ({notSubmittedRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="client">
            <DataTable
              data={workRows}
              columns={clientColumns}
              searchPlaceholder="Search by employee, ID, status…"
              searchKeys={['displayId', 'employeeName', 'employeeDisplayId', 'status']}
              getRowKey={t => t.id}
              onRowClick={t => navigate(`/portal/attendance/${t.id}`)}
              emptyTitle="No worked timesheets"
              emptyDescription="Submitted timesheets with logged hours appear here for client-proof review."
              exportFilename="client-timesheets"
            />
          </TabsContent>

          <TabsContent value="leave">
            <DataTable
              data={leaveRows}
              columns={leaveColumns}
              searchPlaceholder="Search by employee, ID, reason…"
              searchKeys={['displayId', 'employeeName', 'employeeDisplayId', 'leaveReason', 'status']}
              getRowKey={t => t.id}
              onRowClick={t => navigate(`/portal/attendance/${t.id}`)}
              emptyTitle="No leave to review"
              emptyDescription="Timesheets containing leave days appear here for approval."
              exportFilename="leave-approvals"
            />
          </TabsContent>

          <TabsContent value="ghost">
            <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              These timesheets have zero hours AND zero leave days — the employee hasn't filled them in. Contact each employee to correct and resubmit.
            </div>
            <DataTable
              data={ghostRows}
              columns={columns}
              searchPlaceholder="Search by employee, ID, status…"
              searchKeys={['displayId', 'employeeName', 'employeeDisplayId', 'status']}
              getRowKey={t => t.id}
              onRowClick={t => navigate(`/portal/attendance/${t.id}`)}
              emptyTitle="No ghost timesheets"
              emptyDescription="All submitted timesheets have hours or leave days logged."
            />
          </TabsContent>

          <TabsContent value="not-submitted">
            <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Active employees with no monthly timesheet started yet for {monthLabel(notSubmittedYear, notSubmittedMonth)}.
            </div>
            {isNotSubmittedLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <DataTable
                data={notSubmittedRows}
                columns={notSubmittedColumns}
                searchPlaceholder="Search by employee, ID, department…"
                searchKeys={['displayId', 'firstName', 'lastName', 'department']}
                getRowKey={e => e.id}
                emptyTitle="Everyone has started their timesheet"
                emptyDescription={`All active employees have a monthly timesheet for ${monthLabel(notSubmittedYear, notSubmittedMonth)}.`}
                exportFilename="not-submitted-employees"
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
