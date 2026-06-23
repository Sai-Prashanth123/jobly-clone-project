import { useState } from 'react';
import { Plus, Check, X, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import {
  useLeaveRequests, useCreateLeaveRequest, useReviewLeaveRequest, useCancelLeaveRequest,
  LEAVE_TYPE_LABELS,
} from '../hooks/useLeaveRequests';
import type { LeaveRequest, LeaveRequestStatus, LeaveType } from '../types';

const STATUS_STYLES: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export default function LeaveRequests() {
  const { user } = useAuth();
  const isReviewer = user?.role === 'admin' || user?.role === 'hr';
  const canApply = !!user?.employeeId;

  const [statusFilter, setStatusFilter] = useState<string>(isReviewer ? 'pending' : 'all');
  const { data, isLoading } = useLeaveRequests({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 200,
  });
  const requests = data?.data ?? [];

  const createLeave = useCreateLeaveRequest();
  const reviewLeave = useReviewLeaveRequest();
  const cancelLeave = useCancelLeaveRequest();

  // Apply dialog
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState<{ leaveType: LeaveType; startDate: string; endDate: string; reason: string }>(
    { leaveType: 'vacation', startDate: today(), endDate: today(), reason: '' },
  );

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  const submitApply = async () => {
    if (form.endDate < form.startDate) { toast.error('End date must be on or after the start date.'); return; }
    try {
      await createLeave.mutateAsync({ ...form, reason: form.reason.trim() || null });
      toast.success('Leave request submitted — HR has been notified.');
      setApplyOpen(false);
      setForm({ leaveType: 'vacation', startDate: today(), endDate: today(), reason: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to submit leave request. Please try again.');
    }
  };

  const approve = async (r: LeaveRequest) => {
    try {
      await reviewLeave.mutateAsync({ id: r.id, status: 'approved' });
      toast.success(`Leave ${r.displayId ?? ''} approved.`);
    } catch { /* surfaced globally */ }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { toast.error('Add a reason for rejecting.'); return; }
    try {
      await reviewLeave.mutateAsync({ id: rejectTarget.id, status: 'rejected', rejectionReason: rejectReason.trim() });
      toast.success(`Leave ${rejectTarget.displayId ?? ''} rejected.`);
      setRejectTarget(null);
      setRejectReason('');
    } catch { /* surfaced globally */ }
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'displayId', header: 'ID',
      render: r => <span className="text-xs font-mono text-blue-600">{r.displayId ?? r.id.slice(0, 8)}</span>,
      getValue: r => r.displayId ?? '',
    },
    ...(isReviewer ? [{
      key: 'employee', header: 'Employee', sortable: true,
      render: (r: LeaveRequest) => (
        <div>
          <p className="text-sm font-medium">{r.employeeName ?? r.employeeId.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{r.employeeDisplayId}</p>
        </div>
      ),
      getValue: (r: LeaveRequest) => r.employeeName ?? '',
    } as Column<LeaveRequest>] : []),
    {
      key: 'leaveType', header: 'Type',
      render: r => LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType,
      getValue: r => r.leaveType,
    },
    {
      key: 'dates', header: 'Dates', hideOnMobile: true,
      render: r => <span className="text-sm">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span>,
      getValue: r => r.startDate,
    },
    {
      key: 'days', header: 'Days',
      render: r => <span className="text-sm">{r.daysRequested}</span>,
      getValue: r => String(r.daysRequested),
    },
    {
      key: 'status', header: 'Status',
      render: r => (
        <div>
          <LeaveStatusBadge status={r.status} />
          {r.status === 'rejected' && r.rejectionReason && (
            <p className="text-xs text-red-600 mt-0.5 truncate max-w-[160px]" title={r.rejectionReason}>{r.rejectionReason}</p>
          )}
        </div>
      ),
      getValue: r => r.status,
    },
    {
      key: 'actions', header: '', getValue: () => '',
      render: r => (
        <div className="flex items-center gap-1 justify-end">
          {isReviewer && r.status === 'pending' && (
            <>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-emerald-700 hover:bg-emerald-50"
                onClick={() => approve(r)}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-600 hover:bg-red-50"
                onClick={() => { setRejectTarget(r); setRejectReason(''); }}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {r.status === 'pending' && r.employeeId === user?.employeeId && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setCancelTarget(r)}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Time off"
        title="Leave Requests"
        description={isLoading ? 'Loading…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}
        action={canApply ? (
          <Button onClick={() => setApplyOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Apply for Leave</Button>
        ) : undefined}
      />

      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={requests}
        columns={columns}
        searchPlaceholder="Search leave requests…"
        searchKeys={['displayId', 'employeeName', 'leaveType', 'status']}
        getRowKey={r => r.id}
        emptyTitle="No leave requests"
        emptyDescription={isReviewer ? 'Nothing to review right now.' : 'Apply for leave and it will appear here.'}
      />

      {/* Apply dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a leave request for HR/admin approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v as LeaveType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map(t => (
                    <SelectItem key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input type="date" min={today()} value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input type="date" min={form.startDate} value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={form.reason} placeholder="Add any context for HR…"
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={submitApply} loading={createLeave.isPending} loadingText="Submitting…">Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={v => { if (!v) setRejectTarget(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>{rejectTarget?.employeeName} · {rejectTarget && formatDate(rejectTarget.startDate)} – {rejectTarget && formatDate(rejectTarget.endDate)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason <span className="text-red-500">*</span></Label>
            <Textarea rows={3} value={rejectReason} placeholder="Explain why this is being rejected…"
              onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} loading={reviewLeave.isPending} loadingText="Rejecting…">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={v => { if (!v) setCancelTarget(null); }}
        title="Cancel this leave request?"
        description="This withdraws your pending request. You can submit a new one later."
        confirmLabel="Cancel request"
        loading={cancelLeave.isPending}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await cancelLeave.mutateAsync(cancelTarget.id);
            toast.success('Leave request cancelled.');
            setCancelTarget(null);
          } catch { /* surfaced globally */ }
        }}
      />
    </div>
  );
}
