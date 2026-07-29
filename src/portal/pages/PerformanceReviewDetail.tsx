import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Save, Download, Send, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useAuth } from '../hooks/useAuth';
import {
  usePerformanceReview, useUpdatePerformanceReview, useGeneratePerformanceReviewPdf,
  useSendPerformanceReview, RATING_CRITERIA, type PerformanceReviewBody,
} from '../hooks/usePerformanceReviews';

const RATING_LABELS = ['', 'Unsatisfactory', 'Marginal', 'Meets Requirements', 'Exceeds Requirements', 'Exceptional'];

export default function PerformanceReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';

  const { data: review, isLoading, isError } = usePerformanceReview(id);
  const updateReview = useUpdatePerformanceReview(id ?? '');
  const generatePdf = useGeneratePerformanceReviewPdf();
  const sendReview = useSendPerformanceReview(id ?? '');

  const [form, setForm] = useState<PerformanceReviewBody | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    if (!review) return;
    setForm({
      employeeId: review.employeeId,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      salutation: review.salutation ?? '',
      employeeNumber: review.employeeNumber ?? '',
      titlePayrollTitle: review.titlePayrollTitle ?? '',
      employeeType: review.employeeType ?? '',
      supervisorName: review.supervisorName ?? '',
      supervisedFullPeriod: review.supervisedFullPeriod,
      supervisedMonths: review.supervisedMonths ?? null,
      jobRelatedPerformance: review.jobRelatedPerformance ?? '',
      overallEvaluation: review.overallEvaluation ?? '',
      ratings: review.ratings ?? {},
      jobFunction: review.jobFunction ?? '',
      weightPercent: review.weightPercent,
      statusGoal: review.statusGoal ?? '',
      completePercent: review.completePercent,
      performanceEvaluation: review.performanceEvaluation ?? '',
      futureGoals: review.futureGoals ?? '',
      employeeSignedDate: review.employeeSignedDate ?? '',
      supervisorSignedDate: review.supervisorSignedDate ?? '',
    });
  }, [review]);

  if (isLoading || !form) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !review) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Failed to load this review.</p>
      </div>
    );
  }

  const canEdit = isAdmin && review.status === 'draft';
  const set = <K extends keyof PerformanceReviewBody>(key: K, value: PerformanceReviewBody[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
  const setRating = (key: string, value: number) =>
    setForm(prev => (prev ? { ...prev, ratings: { ...prev.ratings, [key]: value } } : prev));

  const handleSave = async () => {
    if (!form) return;
    if (!form.periodStart || !form.periodEnd) {
      toast.error('Period Start and Period End are required');
      return;
    }
    if (form.periodEnd < form.periodStart) {
      toast.error('Period End must be on or after Period Start');
      return;
    }
    try {
      await updateReview.mutateAsync(form);
      toast.success('Draft saved');
    } catch {
      // The mutation cache's global onError already surfaces the real
      // backend message (see queryClient.ts) — a second, generic toast here
      // would just contradict it.
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const url = await generatePdf.mutateAsync(id);
      window.open(url, '_blank');
    } catch {
      toast.error('Could not generate PDF');
    }
  };

  const openSend = () => {
    setRecipientEmail('');
    setSendOpen(true);
  };

  const handleSend = async () => {
    try {
      const result = await sendReview.mutateAsync(recipientEmail ? { recipientEmail } : undefined);
      setSendOpen(false);
      if (result.emailSent) toast.success('Review sent to employee');
      else toast.warning(result.warning ?? 'Could not send email');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Could not send review');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader
        eyebrow="Performance Reviews"
        title={review.employeeName ?? review.displayId}
        description={`${review.displayId} · ${review.status === 'draft' ? 'Draft' : 'Sent'}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/portal/reviews')} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {canEdit && (
              <Button size="sm" onClick={handleSave} disabled={updateReview.isPending} className="gap-1.5">
                {updateReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={generatePdf.isPending} className="gap-1.5">
              {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
            </Button>
            {isAdmin && review.status === 'draft' && (
              <Button size="sm" onClick={openSend} className="gap-1.5">
                <Send className="h-4 w-4" /> Send to Employee
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Period &amp; Employee Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Period Start</Label><UsDateInput value={form.periodStart} onChange={v => set('periodStart', v)} disabled={!canEdit} /></div>
            <div className="space-y-1.5">
              <Label>Period End</Label>
              <UsDateInput value={form.periodEnd} onChange={v => set('periodEnd', v)} min={form.periodStart || undefined} disabled={!canEdit} />
              {form.periodStart && form.periodEnd && form.periodEnd < form.periodStart && (
                <p className="text-[11px] text-red-500">Must be on or after Period Start</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Salutation</Label>
              <Select value={form.salutation || '__none'} onValueChange={v => set('salutation', v === '__none' ? '' : v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="Mr.">Mr.</SelectItem>
                  <SelectItem value="Ms.">Ms.</SelectItem>
                  <SelectItem value="Mx.">Mx.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Employee Number</Label><Input value={form.employeeNumber ?? ''} onChange={e => set('employeeNumber', e.target.value)} disabled={!canEdit} placeholder="NA" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Title / Payroll Title</Label><Input value={form.titlePayrollTitle ?? ''} onChange={e => set('titlePayrollTitle', e.target.value)} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Employee Type</Label><Input value={form.employeeType ?? ''} onChange={e => set('employeeType', e.target.value)} disabled={!canEdit} placeholder="Full time (40 hour per week)" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5"><Label>Supervisor Name</Label><Input value={form.supervisorName ?? ''} onChange={e => set('supervisorName', e.target.value)} disabled={!canEdit} /></div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.supervisedFullPeriod} onCheckedChange={v => set('supervisedFullPeriod', !!v)} disabled={!canEdit} />
                Supervised for entire review period?
              </label>
              {!form.supervisedFullPeriod && (
                <Input type="number" min={0} value={form.supervisedMonths ?? ''} onChange={e => set('supervisedMonths', Number(e.target.value) || 0)} disabled={!canEdit} placeholder="Months supervised" className="w-40" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Job-Related Performance</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.jobRelatedPerformance ?? ''} onChange={e => set('jobRelatedPerformance', e.target.value)} disabled={!canEdit} rows={5} placeholder="Describe the employee's performance during this period…" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Overall Evaluation</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.overallEvaluation ?? ''} onChange={e => set('overallEvaluation', e.target.value)} disabled={!canEdit} rows={6} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supervisor's Recommendation — Ratings</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            (1) Unsatisfactory &middot; (2) Marginal &middot; (3) Meets Requirements &middot; (4) Exceeds Requirements &middot; (5) Exceptional
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {RATING_CRITERIA.map(c => (
            <div key={c.key} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700 sm:w-72 shrink-0">{c.label}</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    disabled={!canEdit}
                    title={RATING_LABELS[n]}
                    onClick={() => setRating(c.key, n)}
                    className={`h-7 w-7 rounded-full border text-xs font-semibold transition-colors ${
                      (form.ratings ?? {})[c.key] === n
                        ? 'bg-[#4069FF] border-[#4069FF] text-white'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-[#4069FF]'
                    } ${!canEdit ? 'cursor-default opacity-70' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Job Function</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5 sm:col-span-2"><Label>Job Function</Label><Input value={form.jobFunction ?? ''} onChange={e => set('jobFunction', e.target.value)} disabled={!canEdit} /></div>
          <div className="space-y-1.5"><Label>Weight (%)</Label><Input type="number" min={0} max={100} value={form.weightPercent ?? 100} onChange={e => set('weightPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} disabled={!canEdit} /></div>
          <div className="space-y-1.5"><Label>Complete (%)</Label><Input type="number" min={0} max={100} value={form.completePercent ?? 100} onChange={e => set('completePercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} disabled={!canEdit} /></div>
          <div className="space-y-1.5 sm:col-span-4"><Label>Status</Label><Input value={form.statusGoal ?? ''} onChange={e => set('statusGoal', e.target.value)} disabled={!canEdit} placeholder="Goal Achieved" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Performance Evaluation</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.performanceEvaluation ?? ''} onChange={e => set('performanceEvaluation', e.target.value)} disabled={!canEdit} rows={6} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Future Goals or Performance Expectations</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={form.futureGoals ?? ''} onChange={e => set('futureGoals', e.target.value)} disabled={!canEdit} rows={5} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Signatures</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Employee Signed Date</Label><UsDateInput value={form.employeeSignedDate ?? ''} onChange={v => set('employeeSignedDate', v)} disabled={!canEdit} /></div>
          <div className="space-y-1.5"><Label>Supervisor Signed Date</Label><UsDateInput value={form.supervisorSignedDate ?? ''} onChange={v => set('supervisorSignedDate', v)} disabled={!canEdit} /></div>
        </CardContent>
      </Card>

      {/* Bottom action bar — mirrors the header actions so a long, multi-card
          review always has a reachable Save control, not just at the top. */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
        {canEdit && (
          <Button size="sm" onClick={handleSave} disabled={updateReview.isPending} className="gap-1.5">
            {updateReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
          </Button>
        )}
        {isAdmin && review.status === 'draft' && (
          <Button size="sm" variant="outline" onClick={openSend} className="gap-1.5">
            <Send className="h-4 w-4" /> Send to Employee
          </Button>
        )}
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="w-[95vw] max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Send Performance Review</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Recipient email (optional override)</Label>
            <Input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="Uses the employee's email on file if blank" />
          </div>
          <p className="text-xs text-muted-foreground">Sending finalizes this review — it can no longer be edited afterward.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sendReview.isPending}>
              {sendReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
