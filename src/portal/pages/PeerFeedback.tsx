import { useState } from 'react';
import { MessageSquare, CheckCircle2, Clock, Loader2, AlertCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useMyPeerRequests, useSubmitPeerFeedback, type PeerRequest } from '../hooks/useReviews';

function StarInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="focus:outline-none">
          <Star className={`h-6 w-6 transition-colors ${i <= (hover || value || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-300'}`} />
        </button>
      ))}
      {value && <span className="ml-2 text-sm text-gray-500">{value}/5</span>}
    </div>
  );
}

export default function PeerFeedback() {
  const { data: requests = [], isLoading } = useMyPeerRequests();
  const submitFeedback = useSubmitPeerFeedback();

  const [activeRequest, setActiveRequest] = useState<PeerRequest | null>(null);
  const [form, setForm] = useState({ rating: null as number | null, strengths: '', improvements: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pending = requests.filter(r => r.status === 'pending');
  const submitted = requests.filter(r => r.status === 'submitted');

  const openRequest = (r: PeerRequest) => {
    setActiveRequest(r);
    setForm({ rating: r.rating ?? null, strengths: r.strengths ?? '', improvements: r.improvements ?? '' });
    setError('');
  };

  const handleSubmit = async () => {
    if (!activeRequest) return;
    setSaving(true); setError('');
    try {
      await submitFeedback.mutateAsync({
        requestId: activeRequest.id,
        rating: form.rating ?? undefined,
        strengths: form.strengths || undefined,
        improvements: form.improvements || undefined,
      });
      setActiveRequest(null);
    } catch (e: any) { setError(e?.response?.data?.error ?? e?.message ?? 'Failed to submit feedback'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-violet-500" /> Peer Feedback
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Give honest, constructive feedback to your colleagues</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No peer feedback requests</p>
          <p className="text-sm">You'll see requests here when colleagues nominate you</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{r.revieweeName ?? 'Colleague'}</p>
                        {r.revieweeTitle && <p className="text-sm text-gray-500">{r.revieweeTitle}</p>}
                        <p className="text-xs text-gray-400 mt-1">Cycle: {r.cycleName}</p>
                        {r.cyclePeerDue && <p className="text-xs text-amber-600 mt-0.5">Due: {r.cyclePeerDue}</p>}
                      </div>
                      <Button size="sm" onClick={() => openRequest(r)} className="gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Give Feedback
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Submitted */}
          {submitted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Submitted ({submitted.length})
              </h2>
              <div className="space-y-3">
                {submitted.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{r.revieweeName ?? 'Colleague'}</p>
                        {r.revieweeTitle && <p className="text-sm text-gray-500">{r.revieweeTitle}</p>}
                        <p className="text-xs text-gray-400 mt-1">Cycle: {r.cycleName}</p>
                        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        {r.rating != null && (
                          <div className="flex items-center gap-0.5 justify-end">
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} className={`h-4 w-4 ${i <= r.rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Feedback dialog */}
      <Dialog open={!!activeRequest} onOpenChange={v => { if (!v) setActiveRequest(null); }}>
        <DialogContent className="w-[95vw] max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Feedback for {activeRequest?.revieweeName ?? 'Colleague'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-1 mb-3">
            Cycle: {activeRequest?.cycleName} · Your feedback is anonymous to the recipient.
          </p>

          {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle className="h-4 w-4" />{error}</p>}

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Rating (optional)</Label>
              <StarInput value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
            </div>
            <div className="space-y-1">
              <Label>Strengths</Label>
              <Textarea
                value={form.strengths}
                onChange={e => setForm(p => ({ ...p, strengths: e.target.value }))}
                rows={4}
                placeholder="What does this person do particularly well? Be specific and constructive."
              />
            </div>
            <div className="space-y-1">
              <Label>Areas for Improvement</Label>
              <Textarea
                value={form.improvements}
                onChange={e => setForm(p => ({ ...p, improvements: e.target.value }))}
                rows={4}
                placeholder="Where could they grow? Provide actionable suggestions."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveRequest(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !(form.strengths?.trim() || form.improvements?.trim())}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
