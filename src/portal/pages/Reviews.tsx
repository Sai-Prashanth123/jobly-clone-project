import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  Star, Plus, Trash2, Play, ChevronRight, Users, CheckCircle2, Clock,
  BarChart3, RefreshCw, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useReviewCycles, useCreateCycle, useUpdateCycle, useActivateCycle,
  useAdvanceCycle, useReleaseResults, useDeleteCycle,
  useParticipants, useAddParticipant, useRemoveParticipant, useSubmitManagerReview,
  STATUS_LABELS, TYPE_LABELS,
  type ReviewCycle, type CycleStatus, type ReviewType,
} from '../hooks/useReviews';
import { useEmployees } from '../hooks/useEmployees';

const STATUS_COLORS: Record<CycleStatus, string> = {
  draft:          'bg-gray-100 text-gray-600',
  active:         'bg-blue-100 text-blue-700',
  peer_feedback:  'bg-violet-100 text-violet-700',
  manager_review: 'bg-amber-100 text-amber-700',
  completed:      'bg-green-100 text-green-700',
};

function CycleBadge({ status }: { status: CycleStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StarRating({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
      <span className="ml-1 text-xs text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

interface CycleFormData {
  name: string; description: string; reviewType: ReviewType;
  selfAssessmentDue: string; peerFeedbackDue: string; managerReviewDue: string;
}

interface CycleFormProps {
  form: CycleFormData;
  setForm: React.Dispatch<React.SetStateAction<CycleFormData>>;
  error: string;
}

function CycleForm({ form, setForm, error }: CycleFormProps) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
      <div className="space-y-1">
        <Label>Cycle Name *</Label>
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Q2 2026 Performance Review" />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
      </div>
      <div className="space-y-1">
        <Label>Review Type</Label>
        <Select value={form.reviewType} onValueChange={v => setForm(p => ({ ...p, reviewType: v as ReviewType }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Self-Assessment Due</Label>
          <Input type="date" value={form.selfAssessmentDue} onChange={e => setForm(p => ({ ...p, selfAssessmentDue: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Peer Feedback Due</Label>
          <Input type="date" value={form.peerFeedbackDue} onChange={e => setForm(p => ({ ...p, peerFeedbackDue: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Manager Review Due</Label>
          <Input type="date" value={form.managerReviewDue} onChange={e => setForm(p => ({ ...p, managerReviewDue: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM: CycleFormData = {
  name: '', description: '', reviewType: 'annual',
  selfAssessmentDue: '', peerFeedbackDue: '', managerReviewDue: '',
};

export default function Reviews() {
  const { data: cycles = [], isLoading } = useReviewCycles();
  const { data: empResult } = useEmployees();
  const employees = empResult?.data ?? [];
  const createCycle = useCreateCycle();
  const updateCycle = useUpdateCycle();
  const activateCycle = useActivateCycle();
  const advanceCycle = useAdvanceCycle();
  const releaseResults = useReleaseResults();
  const deleteCycle = useDeleteCycle();
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();
  const submitMgrReview = useSubmitManagerReview();

  const [createOpen, setCreateOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<ReviewCycle | null>(null);
  const [form, setForm] = useState<CycleFormData>(EMPTY_FORM);
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewCycle | null>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [newParticipantEmpId, setNewParticipantEmpId] = useState('');
  const [newParticipantMgrId, setNewParticipantMgrId] = useState('');
  const [mgrReviewOpen, setMgrReviewOpen] = useState<string | null>(null); // participant employeeId
  const [mgrForm, setMgrForm] = useState({ rating: '', strengths: '', improvements: '', goals: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: participants = [] } = useParticipants(selectedCycle?.id);

  const activeEmployees = employees.filter(e => e.status === 'active');

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setCreateOpen(true); };
  const openEdit = (c: ReviewCycle) => {
    setEditCycle(c);
    setForm({
      name: c.name, description: c.description ?? '',
      reviewType: c.reviewType,
      selfAssessmentDue: c.selfAssessmentDue ?? '',
      peerFeedbackDue: c.peerFeedbackDue ?? '',
      managerReviewDue: c.managerReviewDue ?? '',
    });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (editCycle) {
        await updateCycle.mutateAsync({ id: editCycle.id, ...form });
        setEditCycle(null);
      } else {
        await createCycle.mutateAsync(form);
        setCreateOpen(false);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleActivate = async (id: string) => {
    try { await activateCycle.mutateAsync(id); } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed to activate'); }
  };

  const handleAdvance = async (id: string, toStatus: 'peer_feedback' | 'manager_review') => {
    try { await advanceCycle.mutateAsync({ id, toStatus }); } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed'); }
  };

  const handleRelease = async (id: string) => {
    try { await releaseResults.mutateAsync(id); } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteCycle.mutateAsync(deleteTarget.id); setDeleteTarget(null); } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed'); }
  };

  const handleAddParticipant = async () => {
    if (!selectedCycle || !newParticipantEmpId) return;
    const managerId = (newParticipantMgrId === '_none' || !newParticipantMgrId) ? null : newParticipantMgrId;
    if (managerId && managerId === newParticipantEmpId) {
      toast.error('An employee cannot be their own manager');
      return;
    }
    try {
      await addParticipant.mutateAsync({ cycleId: selectedCycle.id, employeeId: newParticipantEmpId, managerId });
      setNewParticipantEmpId(''); setNewParticipantMgrId('_none'); setAddParticipantOpen(false);
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed'); }
  };

  const handleMgrReview = async () => {
    if (!selectedCycle || !mgrReviewOpen) return;
    if (mgrForm.rating) {
      const r = Number(mgrForm.rating);
      if (isNaN(r) || r < 1 || r > 5) { toast.error('Rating must be between 1 and 5.'); return; }
    }
    setSaving(true);
    try {
      await submitMgrReview.mutateAsync({
        cycleId: selectedCycle.id, employeeId: mgrReviewOpen,
        rating: mgrForm.rating ? Number(mgrForm.rating) : undefined,
        strengths: mgrForm.strengths || undefined,
        improvements: mgrForm.improvements || undefined,
        goals: mgrForm.goals || undefined,
      });
      setMgrReviewOpen(null);
      setMgrForm({ rating: '', strengths: '', improvements: '', goals: '' });
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" /> Performance Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage 360° review cycles</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Cycle</Button>
      </div>

      {/* Cycle list */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No review cycles yet</p>
          <p className="text-sm">Create one to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(cycle => (
            <div key={cycle.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{cycle.name}</span>
                    <CycleBadge status={cycle.status} />
                    <span className="text-xs text-gray-400">{TYPE_LABELS[cycle.reviewType]}</span>
                    {cycle.displayId && <span className="text-xs text-gray-400">{cycle.displayId}</span>}
                  </div>
                  {cycle.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{cycle.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    {cycle.selfAssessmentDue && <span>Self-assessment: {format(parseISO(cycle.selfAssessmentDue), 'MMM d, yyyy')}</span>}
                    {cycle.peerFeedbackDue && <span>Peer feedback: {format(parseISO(cycle.peerFeedbackDue), 'MMM d, yyyy')}</span>}
                    {cycle.managerReviewDue && <span>Manager review: {format(parseISO(cycle.managerReviewDue), 'MMM d, yyyy')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {cycle.status === 'draft' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(cycle)}>Edit</Button>
                      <Button size="sm" onClick={() => handleActivate(cycle.id)} className="gap-1"><Play className="h-3 w-3" /> Activate</Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(cycle)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                  {cycle.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => handleAdvance(cycle.id, 'peer_feedback')} className="gap-1">
                      <RefreshCw className="h-3 w-3" /> → Peer Feedback
                    </Button>
                  )}
                  {cycle.status === 'peer_feedback' && (
                    <Button size="sm" variant="outline" onClick={() => handleAdvance(cycle.id, 'manager_review')} className="gap-1">
                      <RefreshCw className="h-3 w-3" /> → Manager Review
                    </Button>
                  )}
                  {cycle.status === 'manager_review' && (
                    <Button size="sm" onClick={() => handleRelease(cycle.id)} className="gap-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Release Results
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCycle(selectedCycle?.id === cycle.id ? null : cycle)} className="gap-1">
                    <Users className="h-3 w-3" /> Participants <ChevronRight className={`h-3 w-3 transition-transform ${selectedCycle?.id === cycle.id ? 'rotate-90' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Participants panel */}
              {selectedCycle?.id === cycle.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4" /> Participants ({participants.length})
                    </h3>
                    {cycle.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => setAddParticipantOpen(true)} className="gap-1 text-xs">
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    )}
                  </div>
                  {participants.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No participants yet</p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map(p => (
                        <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{p.employeeName ?? p.employeeId}</span>
                              {p.employeeDisplayId && <span className="text-xs text-gray-400">{p.employeeDisplayId}</span>}
                              {p.employeeTitle && <span className="text-xs text-gray-400">· {p.employeeTitle}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className={`flex items-center gap-1 ${p.selfSubmittedAt ? 'text-green-600' : ''}`}>
                                {p.selfSubmittedAt ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                Self {p.selfSubmittedAt ? 'submitted' : 'pending'}
                              </span>
                              <span className={`flex items-center gap-1 ${p.managerSubmittedAt ? 'text-green-600' : ''}`}>
                                {p.managerSubmittedAt ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                Manager {p.managerSubmittedAt ? 'submitted' : 'pending'}
                              </span>
                              {p.overallRating != null && (
                                <span className="flex items-center gap-1">Overall: <StarRating value={p.overallRating} /></span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {['active','peer_feedback','manager_review','completed'].includes(cycle.status) && (
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                                setMgrReviewOpen(p.employeeId);
                                setMgrForm({
                                  rating: p.managerRating?.toString() ?? '',
                                  strengths: p.managerStrengths ?? '',
                                  improvements: p.managerImprovements ?? '',
                                  goals: p.managerGoals ?? '',
                                });
                              }}>
                                {p.managerSubmittedAt ? 'Edit Review' : 'Add Review'}
                              </Button>
                            )}
                            {cycle.status === 'draft' && (
                              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                                onClick={() => removeParticipant.mutate({ cycleId: cycle.id, employeeId: p.employeeId })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-lg" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Review Cycle</DialogTitle></DialogHeader>
          <CycleForm form={form} setForm={setForm} error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Cycle'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editCycle} onOpenChange={v => { if (!v) setEditCycle(null); }}>
        <DialogContent className="w-[95vw] max-w-lg" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Edit Cycle</DialogTitle></DialogHeader>
          <CycleForm form={form} setForm={setForm} error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCycle(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add participant dialog */}
      <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
        <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Participant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select value={newParticipantEmpId} onValueChange={setNewParticipantEmpId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.displayId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Manager (optional)</Label>
              <Select value={newParticipantMgrId || '_none'} onValueChange={v => setNewParticipantMgrId(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {activeEmployees.filter(e => e.id !== newParticipantEmpId).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddParticipantOpen(false)}>Cancel</Button>
            <Button onClick={handleAddParticipant} disabled={!newParticipantEmpId || addParticipant.isPending}>
              {addParticipant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager review dialog */}
      <Dialog open={!!mgrReviewOpen} onOpenChange={v => { if (!v) setMgrReviewOpen(null); }}>
        <DialogContent className="w-[95vw] max-w-lg" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Manager Review</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Rating (1–5)</Label>
              <Input type="number" min={1} max={5} value={mgrForm.rating}
                onChange={e => setMgrForm(p => ({ ...p, rating: e.target.value }))} placeholder="e.g. 4" />
            </div>
            <div className="space-y-1">
              <Label>Strengths</Label>
              <Textarea value={mgrForm.strengths} onChange={e => setMgrForm(p => ({ ...p, strengths: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Areas for Improvement</Label>
              <Textarea value={mgrForm.improvements} onChange={e => setMgrForm(p => ({ ...p, improvements: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Goals for Next Period</Label>
              <Textarea value={mgrForm.goals} onChange={e => setMgrForm(p => ({ ...p, goals: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMgrReviewOpen(null)}>Cancel</Button>
            <Button onClick={handleMgrReview} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deleteTarget?.name}" and all its participants. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
