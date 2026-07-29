import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { usePerformanceReviews, useCreatePerformanceReview, type PerformanceReview } from '../hooks/usePerformanceReviews';
import { useEmployees } from '../hooks/useEmployees';
import { formatDate, formatDateUS } from '../lib/utils';
import { currentMonth, monthInputValue } from '../lib/monthUtils';

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent' };
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-emerald-100 text-emerald-700',
};

export default function PerformanceReviews() {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = usePerformanceReviews();
  const { data: empData } = useEmployees({ limit: 500, status: 'active' });
  const createReview = useCreatePerformanceReview();

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');

  const rows = data?.data ?? [];
  const employees = empData?.data ?? [];

  const openCreate = () => { setEmployeeId(''); setOpen(true); };

  const handleCreate = async () => {
    if (!employeeId) { toast.error('Select an employee'); return; }
    const emp = employees.find(e => e.id === employeeId);
    const { year, month } = currentMonth();
    const start = `${monthInputValue(year, month)}-01`;
    try {
      const review = await createReview.mutateAsync({
        employeeId,
        periodStart: start,
        periodEnd: start,
        titlePayrollTitle: emp?.jobTitle,
        employeeNumber: emp?.displayId,
        employeeType: emp?.employmentType === 'full_time' ? 'Full time (40 hour per week)' : emp?.employmentType,
      });
      setOpen(false);
      navigate(`/portal/reviews/${review.id}`);
    } catch {
      toast.error('Could not create review');
    }
  };

  const columns: Column<PerformanceReview>[] = [
    {
      key: 'displayId', header: 'ID',
      render: r => <span className="text-xs font-mono text-blue-600">{r.displayId}</span>,
      getValue: r => r.displayId,
    },
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div className="min-w-0">
          <p className="font-medium truncate">{r.employeeName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{r.employeeDisplayId ?? ''}</p>
        </div>
      ),
      getValue: r => r.employeeName ?? '', sortable: true,
    },
    {
      key: 'period', header: 'Period',
      render: r => `${formatDateUS(r.periodStart)} – ${formatDateUS(r.periodEnd)}`,
      getValue: r => r.periodStart, sortable: true,
    },
    {
      key: 'status', header: 'Status',
      render: r => <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>,
      getValue: r => r.status, sortable: true,
    },
    {
      key: 'createdAt', header: 'Created', hideOnMobile: true,
      render: r => formatDate(r.createdAt),
      getValue: r => r.createdAt, sortable: true,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Performance Reviews"
        description={isLoading ? 'Loading…' : `${rows.length} review${rows.length === 1 ? '' : 's'}`}
        action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Review</Button>}
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
          <p className="text-sm">Failed to load reviews. Please refresh.</p>
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by employee, ID…"
          searchKeys={['displayId', 'employeeName', 'employeeDisplayId']}
          getRowKey={r => r.id}
          onRowClick={r => navigate(`/portal/reviews/${r.id}`)}
          emptyTitle="No performance reviews yet"
          emptyDescription="Create a review for an employee to get started."
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Performance Review</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select an employee…" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createReview.isPending}>
              {createReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
