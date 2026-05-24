import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Download, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useMonthlyTimesheet, usePatchMonthlyStatus } from '../hooks/useMonthlyTimesheets';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';
import { formatDate } from '../lib/utils';
import { MONTHS, monthLabel } from '../lib/monthUtils';
import type { MonthlyDayStatus } from '../types';

const PILL: Record<MonthlyDayStatus, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  leave: 'bg-amber-100 text-amber-700',
  holiday: 'bg-violet-100 text-violet-700',
  absent: 'bg-red-100 text-red-700',
  weekend: 'bg-gray-100 text-gray-500',
};

export default function MonthlyTimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sheet, isLoading } = useMonthlyTimesheet(id);
  const patchStatus = usePatchMonthlyStatus(id!);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [downloading, setDownloading] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!sheet) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Timesheet not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/attendance/review')}>← Back to Attendance Review</Button>
      </div>
    );
  }

  // Reviewer can act when it's submitted AND they're not the owner (admin/hr, or
  // a reporting manager — backend already gated the fact they can see it).
  const isOwnSheet = sheet.employeeId === user?.employeeId;
  const canReview = sheet.status === 'submitted' && (user?.role === 'admin' || user?.role === 'hr' || (user?.role === 'employee' && !isOwnSheet));
  const balance = Math.round((sheet.totalHours - sheet.expectedHours) * 100) / 100;

  const handleApprove = async () => {
    try {
      await patchStatus.mutateAsync({ status: 'approved' });
      toast.success('Timesheet approved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to approve.');
    }
  };

  const handleReject = async () => {
    try {
      await patchStatus.mutateAsync({ status: 'rejected', rejectionReason: rejectReason.trim() || undefined });
      toast.success('Timesheet rejected — the employee has been notified.');
      setRejectOpen(false);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to reject.');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    const win = window.open('about:blank', '_blank');
    try {
      const { data } = await apiClient.get(`/monthly-timesheets/${sheet.id}/pdf`);
      const url = data?.data?.url;
      if (url && win) win.location.href = url;
      else { win?.close(); toast.error('Could not generate the PDF.'); }
    } catch {
      win?.close();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <button onClick={() => navigate('/portal/attendance/review')} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Attendance Review
      </button>

      <PageHeader
        eyebrow="Attendance"
        title={`${monthLabel(sheet.year, sheet.month)} — ${sheet.employeeName ?? 'Employee'}`}
        description={`${sheet.displayId ?? ''}${sheet.department ? ` · ${sheet.department}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={sheet.status} />
            <Button variant="outline" size="sm" onClick={handleDownload} loading={downloading} loadingText="Preparing…" className="gap-1.5">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {sheet.status === 'rejected' && sheet.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Rejected:</strong> {sheet.rejectionReason}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Total Hours" value={sheet.totalHours.toFixed(1)} variant="blue" description="Hours logged" />
        <StatCard title="Expected Hours" value={sheet.expectedHours} variant="orange" description="Working days × 8" />
        <StatCard title="Balance" value={`${balance >= 0 ? '+' : ''}${balance.toFixed(1)}`} variant={balance >= 0 ? 'green' : 'red'} description="Over / under" />
        <StatCard title="Leave Days" value={sheet.leaveDays} variant="purple" description="Marked as leave" />
        <StatCard title="Working Days" value={sheet.workingDays} variant="cyan" description="In this month" />
      </div>

      {/* Day table (read-only) */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#4069FF] to-[#32CDDC] py-3">
          <CardTitle className="text-white text-sm">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2 text-left font-semibold w-24">Date</th>
                  <th className="px-3 py-2 text-left font-semibold w-12">Day</th>
                  <th className="px-3 py-2 text-left font-semibold w-32">Project</th>
                  <th className="px-3 py-2 text-left font-semibold">Task</th>
                  <th className="px-3 py-2 text-center font-semibold w-20">Start</th>
                  <th className="px-3 py-2 text-center font-semibold w-20">End</th>
                  <th className="px-3 py-2 text-center font-semibold w-16">Hours</th>
                  <th className="px-3 py-2 text-center font-semibold w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {sheet.entries.map(e => {
                  const dayNum = Number(e.date.slice(-2));
                  const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTHS[sheet.month - 1].slice(0, 3)}`;
                  return (
                    <tr key={e.date} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-600 whitespace-nowrap">{dateStr}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{e.dayOfWeek}</td>
                      <td className="px-3 py-1.5 text-xs">{e.project || '—'}</td>
                      <td className="px-3 py-1.5 text-xs">{e.task || '—'}</td>
                      <td className="px-3 py-1.5 text-center text-xs font-mono text-gray-500">{e.startTime || '—'}</td>
                      <td className="px-3 py-1.5 text-center text-xs font-mono text-gray-500">{e.endTime || '—'}</td>
                      <td className={`px-3 py-1.5 text-center font-mono text-xs font-semibold ${e.status === 'present' && e.hours > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {e.status === 'present' && e.hours > 0 ? e.hours.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${PILL[e.status]}`}>{e.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {sheet.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{sheet.notes}</p></CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        {sheet.submittedAt && <p>Submitted {formatDate(sheet.submittedAt)}</p>}
        {sheet.reviewedAt && <p>Reviewed {formatDate(sheet.reviewedAt)}</p>}
      </div>

      {canReview && (
        <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-white/90 backdrop-blur border-t py-3">
          <Button variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectOpen(true)} disabled={patchStatus.isPending}>
            <XCircle className="h-4 w-4" /> Reject
          </Button>
          <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} loading={patchStatus.isPending} loadingText="Approving…">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this timesheet?</DialogTitle>
            <DialogDescription>The employee is notified and can correct &amp; resubmit. A reason is recommended.</DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Reason for rejection (optional)…"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#4069FF]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleReject} loading={patchStatus.isPending} loadingText="Rejecting…">
              Reject Timesheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
