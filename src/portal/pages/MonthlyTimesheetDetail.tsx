import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Download, CheckCircle2, XCircle, FileText, Mail, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useMonthlyTimesheet, usePatchMonthlyStatus, usePatchHrNotes, usePatchMonthlyTimesheetEntries } from '../hooks/useMonthlyTimesheets';
import { useAuth } from '../hooks/useAuth';
import { useHolidays } from '../hooks/useHolidays';
import { apiClient } from '../lib/apiClient';
import { formatDate } from '../lib/utils';
import { MONTHS, monthLabel } from '../lib/monthUtils';
import type { MonthlyDayStatus, MonthlyTimesheetEntry } from '../types';
import { EntityAuditTrail } from '../components/shared/EntityAuditTrail';

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
  const { data: sheet, isLoading, isError, refetch } = useMonthlyTimesheet(id);
  const patchStatus = usePatchMonthlyStatus(id!);
  const patchHrNotes = usePatchHrNotes(id!);
  const patchEntries = usePatchMonthlyTimesheetEntries(id!);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [hrNotes, setHrNotes] = useState<string | undefined>(undefined);
  const hrNotesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editEntriesOpen, setEditEntriesOpen] = useState(false);
  const [editEntries, setEditEntries] = useState<MonthlyTimesheetEntry[]>([]);
  // Purely informational: flag entries whose date is a company holiday added
  // AFTER the employee's original submission (so the stored status never got
  // auto-marked 'holiday'). Doesn't change any value automatically.
  const { data: sheetYearHolidays } = useHolidays(sheet?.year, { enabled: !!sheet?.year });
  const holidayDatesSet = new Set((sheetYearHolidays ?? []).map(h => h.date));

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load timesheet. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
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

  const handleApprove = async () => {
    try {
      await patchStatus.mutateAsync({ status: 'approved' });
      toast.success('Timesheet approved.');
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const handleReject = async () => {
    try {
      await patchStatus.mutateAsync({ status: 'rejected', rejectionReason: rejectReason.trim() || undefined });
      toast.success('Timesheet rejected — the employee has been notified.');
      setRejectOpen(false);
      setRejectReason('');
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const isHrAdmin = user?.role === 'admin' || user?.role === 'hr';

  const handleSaveHrNotes = async () => {
    const notes = hrNotes ?? sheet?.hrNotes ?? '';
    try {
      await patchHrNotes.mutateAsync(notes);
      toast.success('Notes saved.');
    } catch {
      /* handled centrally */
    }
  };

  const handleNoteChange = (val: string) => {
    setHrNotes(val);
    if (hrNotesSaveTimer.current) clearTimeout(hrNotesSaveTimer.current);
    hrNotesSaveTimer.current = setTimeout(() => {
      patchHrNotes.mutate(val);
    }, 1500);
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

  // Word-doc export — a direct binary stream (no public URL to redirect a
  // pre-opened tab to like the PDF), so fetch as a blob and trigger a
  // temporary anchor download instead.
  const handleDownloadWord = async () => {
    setDownloadingDocx(true);
    try {
      const res = await apiClient.get(`/monthly-timesheets/${sheet.id}/docx`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sheet.displayId ?? 'timesheet'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not generate the Word document.');
    } finally {
      setDownloadingDocx(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sheet.status} />
            {isHrAdmin && sheet.employeeEmail && (
              <a
                href={`mailto:${sheet.employeeEmail}?subject=Regarding your ${monthLabel(sheet.year, sheet.month)} timesheet&body=Hi ${sheet.employeeName ?? 'there'},%0A%0A`}
                className="inline-flex"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Mail className="h-4 w-4" /> Contact
                </Button>
              </a>
            )}
            {isHrAdmin && (
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => { setEditEntries([...sheet.entries]); setEditEntriesOpen(true); }}>
                <Edit className="h-4 w-4" /> Edit Entries
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} loading={downloading} loadingText="Preparing…" className="gap-1.5">
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadWord} loading={downloadingDocx} loadingText="Preparing…" className="gap-1.5">
              <FileText className="h-4 w-4" /> Word
            </Button>
          </div>
        }
      />

      {sheet.status === 'rejected' && sheet.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Rejected:</strong> {sheet.rejectionReason}
        </div>
      )}

      {/* Review artifacts: client-signed proof (worked months) + leave reason
          (leave months) surfaced up front so the reviewer acts on the right thing. */}
      {(sheet.clientSignedUrl || sheet.leaveReason) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sheet.clientSignedUrl && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-800">Client-signed timesheet</p>
                  <a href={sheet.clientSignedUrl} target="_blank" rel="noopener" className="text-sm text-emerald-700 hover:underline truncate block">
                    {sheet.clientSignedFilename ?? 'Open proof'}
                  </a>
                </div>
              </div>
            </div>
          )}
          {sheet.leaveReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-xs font-medium text-amber-800">Leave reason</p>
              <p className="text-sm text-amber-900 mt-0.5 capitalize">{sheet.leaveReason.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total Hours" value={sheet.totalHours.toFixed(1)} variant="blue" description="Hours logged" />
        <StatCard title="Expected Hours" value={sheet.expectedHours} variant="orange" description="Working days × 8" />
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

      {isHrAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">HR Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              value={hrNotes ?? sheet.hrNotes ?? ''}
              onChange={e => handleNoteChange(e.target.value)}
              rows={3}
              placeholder="Internal notes visible to HR and admin only…"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#4069FF]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-saves after 1.5 s of inactivity</span>
              <Button size="sm" variant="outline" onClick={handleSaveHrNotes} loading={patchHrNotes.isPending} loadingText="Saving…">
                Save Notes
              </Button>
            </div>
          </CardContent>
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
          <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setApproveOpen(true)} disabled={patchStatus.isPending}>
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        </div>
      )}

      <EntityAuditTrail entityType="monthly_timesheet" entityId={sheet?.id} />

      <Dialog open={editEntriesOpen} onOpenChange={setEditEntriesOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Entries — {monthLabel(sheet.year, sheet.month)}</DialogTitle>
            <DialogDescription>Adjust daily hours and status as admin/HR. Changes bypass the status lock.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2 text-left w-24">Date</th>
                    <th className="px-3 py-2 text-left w-12">Day</th>
                    <th className="px-3 py-2 text-left w-32">Project</th>
                    <th className="px-3 py-2 text-left w-32">Task</th>
                    <th className="px-3 py-2 text-center w-20">Hours</th>
                    <th className="px-3 py-2 text-center w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {editEntries.map((e, i) => {
                    const isUnmarkedHoliday = e.status !== 'holiday' && e.status !== 'weekend' && holidayDatesSet.has(e.date);
                    return (
                    <tr key={e.date} className="border-b border-gray-100">
                      <td className="px-3 py-1 font-mono text-xs text-gray-600">
                        {e.date}
                        {isUnmarkedHoliday && (
                          <span className="ml-1 inline-block text-[9px] font-semibold px-1 py-0.5 rounded bg-violet-100 text-violet-700" title="Company holiday added after this timesheet was submitted">
                            Holiday
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs text-gray-500">{e.dayOfWeek}</td>
                      <td className="px-3 py-1">
                        <input
                          type="text"
                          value={e.project ?? ''}
                          disabled={e.status === 'weekend'}
                          onChange={ev => {
                            const updated = [...editEntries];
                            updated[i] = { ...updated[i], project: ev.target.value };
                            setEditEntries(updated);
                          }}
                          className="w-full rounded border border-gray-200 px-2 py-0.5 text-xs focus:outline-none focus:border-[#4069FF] disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="text"
                          value={e.task ?? ''}
                          disabled={e.status === 'weekend'}
                          onChange={ev => {
                            const updated = [...editEntries];
                            updated[i] = { ...updated[i], task: ev.target.value };
                            setEditEntries(updated);
                          }}
                          className="w-full rounded border border-gray-200 px-2 py-0.5 text-xs focus:outline-none focus:border-[#4069FF] disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <input
                          type="number" min={0} max={24} step={0.5}
                          value={e.hours}
                          disabled={e.status === 'weekend' || e.status === 'holiday'}
                          onChange={ev => {
                            const updated = [...editEntries];
                            updated[i] = { ...updated[i], hours: Number(ev.target.value) || 0 };
                            setEditEntries(updated);
                          }}
                          className="w-16 text-center rounded border border-gray-200 px-2 py-0.5 text-xs focus:outline-none focus:border-[#4069FF] disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <select
                          value={e.status}
                          onChange={ev => {
                            const updated = [...editEntries];
                            updated[i] = { ...updated[i], status: ev.target.value as MonthlyDayStatus };
                            setEditEntries(updated);
                          }}
                          className="rounded border border-gray-200 px-2 py-0.5 text-xs focus:outline-none focus:border-[#4069FF]"
                        >
                          <option value="present">Present</option>
                          <option value="leave">Leave</option>
                          <option value="absent">Absent</option>
                          <option value="holiday">Holiday</option>
                          <option value="weekend">Weekend</option>
                        </select>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntriesOpen(false)}>Cancel</Button>
            <Button
              loading={patchEntries.isPending} loadingText="Saving…"
              onClick={async () => {
                try {
                  await patchEntries.mutateAsync({ entries: editEntries });
                  toast.success('Entries updated');
                  setEditEntriesOpen(false);
                } catch {}
              }}
            >Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve this timesheet?</DialogTitle>
            <DialogDescription>The employee will be notified that their attendance record has been approved.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { setApproveOpen(false); await handleApprove(); }} loading={patchStatus.isPending} loadingText="Approving…">Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
