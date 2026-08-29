import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DetailField as Field } from '../shared/DetailField';
import { useCasePermDetails, useUpsertPermDetails, type CasePermDetails } from '../../hooks/useCases';
import { CaseDocumentsPanel } from './CaseDocumentsPanel';

const empty: CasePermDetails = {
  jobTitle: '', fullTimePosition: undefined, workHoursPerWeek: undefined, wageRate: undefined,
  socCode: '', payFrequency: '', classification: '', permanentPosition: undefined,
  experienceRequired: undefined, monthsOfExperience: undefined, workAddress: '',
  minimumEducation: '', majorFieldOfStudy: '',
};

export function CasePermForm({ caseId }: { caseId: string }) {
  const { data: perm, isLoading } = useCasePermDetails(caseId);
  const upsert = useUpsertPermDetails(caseId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CasePermDetails>(empty);

  useEffect(() => {
    if (perm) setForm({ ...empty, ...perm });
  }, [perm]);

  const set = <K extends keyof CasePermDetails>(key: K, value: CasePermDetails[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    try {
      await upsert.mutateAsync(form);
      toast.success('PERM job details saved');
      setEditing(false);
    } catch {
      toast.error('Could not save. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Job Details</p>
        {!editing && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Job Title" value={perm?.jobTitle} />
          <Field label="Full Time Position" value={perm?.fullTimePosition == null ? undefined : (perm.fullTimePosition ? 'Yes' : 'No')} />
          <Field label="Work Hours per Week" value={perm?.workHoursPerWeek != null ? String(perm.workHoursPerWeek) : undefined} />
          <Field label="Wage Rate" value={perm?.wageRate != null ? `$${perm.wageRate}` : undefined} />
          <Field label="SOC Code Details" value={perm?.socCode} />
          <Field label="Pay Frequency" value={perm?.payFrequency} />
          <Field label="Classification" value={perm?.classification} />
          <Field label="Permanent Position" value={perm?.permanentPosition == null ? undefined : (perm.permanentPosition ? 'Yes' : 'No')} />
          <Field label="Experience Required" value={perm?.experienceRequired == null ? undefined : (perm.experienceRequired ? 'Yes' : 'No')} />
          <Field label="No of Months of Experience" value={perm?.monthsOfExperience != null ? String(perm.monthsOfExperience) : undefined} />
          <Field label="Minimum Education" value={perm?.minimumEducation} />
          <Field label="Major Field of Study" value={perm?.majorFieldOfStudy} />
          <div className="sm:col-span-3">
            <Field label="Work Address" value={perm?.workAddress} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Job Title</Label><Input value={form.jobTitle ?? ''} onChange={e => set('jobTitle', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Work Hours per Week</Label><Input type="number" value={form.workHoursPerWeek ?? ''} onChange={e => set('workHoursPerWeek', e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div className="space-y-1.5"><Label>Wage Rate ($)</Label><Input type="number" value={form.wageRate ?? ''} onChange={e => set('wageRate', e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div className="space-y-1.5"><Label>SOC Code Details</Label><Input value={form.socCode ?? ''} onChange={e => set('socCode', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Pay Frequency</Label><Input value={form.payFrequency ?? ''} onChange={e => set('payFrequency', e.target.value)} placeholder="e.g. Month" /></div>
          <div className="space-y-1.5"><Label>Classification</Label><Input value={form.classification ?? ''} onChange={e => set('classification', e.target.value)} placeholder="e.g. EB-3" /></div>
          <div className="space-y-1.5"><Label>Months of Experience</Label><Input type="number" value={form.monthsOfExperience ?? ''} onChange={e => set('monthsOfExperience', e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div className="space-y-1.5"><Label>Minimum Education</Label><Input value={form.minimumEducation ?? ''} onChange={e => set('minimumEducation', e.target.value)} placeholder="e.g. Bachelors" /></div>
          <div className="space-y-1.5"><Label>Major Field of Study</Label><Input value={form.majorFieldOfStudy ?? ''} onChange={e => set('majorFieldOfStudy', e.target.value)} /></div>
          <div className="sm:col-span-3 space-y-1.5"><Label>Work Address</Label><Input value={form.workAddress ?? ''} onChange={e => set('workAddress', e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <Checkbox checked={!!form.fullTimePosition} onCheckedChange={v => set('fullTimePosition', !!v)} />
            <Label className="font-normal">Full Time Position</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={!!form.permanentPosition} onCheckedChange={v => set('permanentPosition', !!v)} />
            <Label className="font-normal">Permanent Position</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={!!form.experienceRequired} onCheckedChange={v => set('experienceRequired', !!v)} />
            <Label className="font-normal">Experience in the job offered required</Label>
          </div>
          <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setForm({ ...empty, ...perm }); setEditing(false); }} disabled={upsert.isPending}>Cancel</Button>
            <Button onClick={save} loading={upsert.isPending} loadingText="Saving…">Save</Button>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">PERM Documents</p>
        <CaseDocumentsPanel caseId={caseId} categories={['PERM Documents']} />
      </div>
    </div>
  );
}
