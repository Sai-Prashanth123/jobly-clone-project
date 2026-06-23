import { useState } from 'react';
import { Star, CheckCircle2, Clock, Loader2, AlertCircle, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  useReviewCycles, useMyReview, useMyReviewResults,
  useSubmitSelfAssessment, useNominatePeers,
  STATUS_LABELS, type ReviewCycle,
} from '../hooks/useReviews';
import { useEmployeeDirectory } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';

function StarDisplay({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 w-32">{label}</span>
      {value != null ? (
        <span className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
          ))}
          <span className="ml-1.5 text-sm font-semibold text-gray-700">{typeof value === 'number' ? value.toFixed(1) : value}</span>
        </span>
      ) : <span className="text-sm text-gray-400">Not rated</span>}
    </div>
  );
}

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

function CycleCard({
  cycle, onOpen,
}: { cycle: ReviewCycle; onOpen: (c: ReviewCycle) => void }) {
  const { data: myReview } = useMyReview(cycle.id);
  const { data: results } = useMyReviewResults(cycle.status === 'completed' ? cycle.id : undefined);

  const submitted = !!myReview?.selfSubmittedAt;
  const released = !!myReview?.releasedAt;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{cycle.name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {STATUS_LABELS[cycle.status]}
            </span>
          </div>
          {cycle.selfAssessmentDue && (
            <p className="text-xs text-gray-400 mt-1">Self-assessment due: {cycle.selfAssessmentDue}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className={`flex items-center gap-1 ${submitted ? 'text-green-600' : 'text-amber-600'}`}>
              {submitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              Self-assessment {submitted ? 'submitted' : 'pending'}
            </span>
            {released && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Results released</span>}
          </div>
          {released && results && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs font-semibold text-green-800 mb-2">Your Results</p>
              <StarDisplay value={results.overallRating} label="Overall Rating" />
              <StarDisplay value={results.selfRating ?? null} label="Self Rating" />
              <StarDisplay value={results.managerRating ?? null} label="Manager Rating" />
              {results.peerFeedbackSummary && (
                <StarDisplay value={results.peerFeedbackSummary.avgPeerRating} label={`Peer Rating (${results.peerFeedbackSummary.peerCount})`} />
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {['active', 'peer_feedback'].includes(cycle.status) && !submitted && (
            <Button size="sm" onClick={() => onOpen(cycle)} className="gap-1"><Send className="h-3.5 w-3.5" /> Submit Self-Assessment</Button>
          )}
          {submitted && !released && (
            <Button size="sm" variant="outline" onClick={() => onOpen(cycle)}>Edit Self-Assessment</Button>
          )}
          {['active','peer_feedback'].includes(cycle.status) && (
            <Button size="sm" variant="outline" onClick={() => onOpen(cycle)}>Nominate Peers</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyReview() {
  const { user } = useAuth();
  const { data: cycles = [], isLoading } = useReviewCycles();
  const { data: employees = [] } = useEmployeeDirectory();
  const submitSelf = useSubmitSelfAssessment();
  const nominatePeers = useNominatePeers();

  const [activeCycle, setActiveCycle] = useState<ReviewCycle | null>(null);
  const { data: myReview } = useMyReview(activeCycle?.id);
  const [selfForm, setSelfForm] = useState({ strengths: '', improvements: '', goals: '', rating: null as number | null });
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'self' | 'peers'>('self');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const myCycles = cycles.filter(c => ['active','peer_feedback','manager_review','completed'].includes(c.status));

  const openCycle = (c: ReviewCycle) => {
    setActiveCycle(c);
    if (myReview) {
      setSelfForm({
        strengths: myReview.selfStrengths ?? '',
        improvements: myReview.selfImprovements ?? '',
        goals: myReview.selfGoals ?? '',
        rating: myReview.selfRating ?? null,
      });
    } else {
      setSelfForm({ strengths: '', improvements: '', goals: '', rating: null });
    }
    setPeerIds([]);
    setTab('self');
    setError('');
  };

  const handleSubmitSelf = async () => {
    if (!activeCycle) return;
    setSaving(true); setError('');
    try {
      await submitSelf.mutateAsync({ cycleId: activeCycle.id, ...selfForm, rating: selfForm.rating ?? undefined });
      setActiveCycle(null);
    } catch (e: any) { setError(e?.response?.data?.error ?? e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const handleNominatePeers = async () => {
    if (!activeCycle || peerIds.length === 0) return;
    setSaving(true); setError('');
    try {
      await nominatePeers.mutateAsync({ cycleId: activeCycle.id, peerEmployeeIds: peerIds });
      setActiveCycle(null);
    } catch (e: any) { setError(e?.response?.data?.error ?? e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const togglePeer = (id: string) => {
    setPeerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const activeEmployees = employees.filter(e => e.id !== user?.employeeId && e.id !== myReview?.managerId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="h-6 w-6 text-amber-500" /> My Performance Review
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete your self-assessments and view released results</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : myCycles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No active review cycles</p>
          <p className="text-sm">Check back when HR starts a new cycle</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myCycles.map(c => <CycleCard key={c.id} cycle={c} onOpen={openCycle} />)}
        </div>
      )}

      {/* Self-assessment / Peer nomination dialog */}
      <Dialog open={!!activeCycle} onOpenChange={v => { if (!v) setActiveCycle(null); }}>
        <DialogContent className="w-[95vw] max-w-xl">
          <DialogHeader>
            <DialogTitle>{activeCycle?.name}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 mb-4">
            {(['self', 'peers'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t === 'self' ? 'Self-Assessment' : 'Nominate Peers'}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 flex items-center gap-1 mb-3"><AlertCircle className="h-4 w-4" />{error}</p>}

          {tab === 'self' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Self Rating</Label>
                <StarInput value={selfForm.rating} onChange={v => setSelfForm(p => ({ ...p, rating: v }))} />
              </div>
              <div className="space-y-1">
                <Label>Strengths</Label>
                <Textarea value={selfForm.strengths} onChange={e => setSelfForm(p => ({ ...p, strengths: e.target.value }))} rows={3} placeholder="What have you done well this period?" />
              </div>
              <div className="space-y-1">
                <Label>Areas for Improvement</Label>
                <Textarea value={selfForm.improvements} onChange={e => setSelfForm(p => ({ ...p, improvements: e.target.value }))} rows={3} placeholder="Where can you grow?" />
              </div>
              <div className="space-y-1">
                <Label>Goals for Next Period</Label>
                <Textarea value={selfForm.goals} onChange={e => setSelfForm(p => ({ ...p, goals: e.target.value }))} rows={2} placeholder="What do you want to achieve?" />
              </div>
            </div>
          )}

          {tab === 'peers' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Select colleagues to give you feedback (1–10 peers)</p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {activeEmployees.map(e => (
                  <label key={e.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${peerIds.includes(e.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={peerIds.includes(e.id)} onChange={() => togglePeer(e.id)} className="h-4 w-4 rounded border-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.firstName} {e.lastName}</p>
                      <p className="text-xs text-gray-400">{e.jobTitle} · {e.department}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400">{peerIds.length} selected</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveCycle(null)}>Cancel</Button>
            {tab === 'self' ? (
              <Button onClick={handleSubmitSelf} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Self-Assessment'}</Button>
            ) : (
              <Button onClick={handleNominatePeers} disabled={saving || peerIds.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Nominate ${peerIds.length} Peers`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
