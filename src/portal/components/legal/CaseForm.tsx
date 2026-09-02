import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import type { LegalCase, CaseType, CaseStatus } from '../../types';
import { useEmployees, useCreateEmployee } from '../../hooks/useEmployees';
import { getApiErrorMessage } from '../../lib/apiError';
import { usePetitioners, useCreatePetitioner } from '../../hooks/useCases';
import { UsDateInput } from '../shared/UsDateInput';

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  h1b_new: 'H-1B — New',
  h1b_extension: 'H-1B — Extension',
  h1b_transfer: 'H-1B — Transfer',
  perm_green_card: 'PERM / Green Card',
  opt_stem_extension: 'OPT STEM Extension',
  tn_renewal: 'TN — Renewal',
  l1_extension: 'L-1 — Extension',
  other: 'Other',
};

// Free-choice list over a TEXT column on the backend (not a DB enum) — kept
// in sync with backend/src/schemas/case.schema.ts's CASE_CLASSIFICATIONS.
export const CASE_CLASSIFICATIONS = ['EB-1', 'EB-2', 'EB-3', 'H-1B', 'L-1', 'TN', 'O-1', 'Other'] as const;

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  pending_uscis: 'Pending USCIS',
  rfe_received: 'RFE Received',
  case_approved: 'Approved',
  denied: 'Denied',
  closed: 'Closed',
};

type CaseFormData = {
  employeeId: string;
  caseType: CaseType | '';
  status: CaseStatus;
  receiptNumber: string;
  priorityDate: string;
  filedDate: string;
  decisionDate: string;
  attorneyName: string;
  description: string;
  petitionerId: string;
  classification: string;
};

const defaultForm: CaseFormData = {
  employeeId: '', caseType: '', status: 'open',
  receiptNumber: '', priorityDate: '', filedDate: '', decisionDate: '', attorneyName: '', description: '',
  petitionerId: '', classification: '',
};

interface CaseFormProps {
  initial?: Partial<LegalCase>;
  onSubmit: (data: CaseFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
  isPending?: boolean;
}

export function CaseForm({ initial, onSubmit, onCancel, isEdit = false, isPending = false }: CaseFormProps) {
  // The employee picker is disabled (and irrelevant) in edit mode — skip the
  // fetch entirely so opening "Edit" on a case doesn't pull the full
  // employee roster to whoever has Cases access (e.g. legal) but shouldn't
  // see employees they have no case for.
  const { data: empData } = useEmployees({ limit: 500 }, { enabled: !isEdit });
  const employees = empData?.data ?? [];
  const { data: petitioners } = usePetitioners();
  const createPetitioner = useCreatePetitioner();
  const [newPetitionerName, setNewPetitionerName] = useState('');
  // "Quick add candidate" — lets HR/admin open a case for someone who isn't an
  // employee yet, without going through the full onboarding wizard. Creates a
  // minimal, credential-free employee record (see useCreateEmployee's
  // isCandidate flag) and uses its id as the case's employeeId. Non-null means
  // this mode is active (mirrors the petitioner "+ New petitioner…" pattern).
  const [newCandidate, setNewCandidate] = useState<{ firstName: string; lastName: string; email: string } | null>(null);
  const createEmployee = useCreateEmployee();

  const seed = (src?: Partial<LegalCase>): CaseFormData => ({
    employeeId: src?.employeeId ?? defaultForm.employeeId,
    caseType: src?.caseType ?? defaultForm.caseType,
    status: src?.status ?? defaultForm.status,
    receiptNumber: src?.receiptNumber ?? '',
    priorityDate: src?.priorityDate ?? '',
    filedDate: src?.filedDate ?? '',
    decisionDate: src?.decisionDate ?? '',
    attorneyName: src?.attorneyName ?? '',
    description: src?.description ?? '',
    petitionerId: src?.petitionerId ?? '',
    classification: src?.classification ?? '',
  });

  const [form, setForm] = useState<CaseFormData>(seed(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(seed(initial));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const set = <K extends keyof CaseFormData>(field: K, value: CaseFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (newCandidate) {
      if (!newCandidate.firstName.trim() || !newCandidate.lastName.trim() || !newCandidate.email.trim()) {
        errs.employeeId = 'New candidate needs a first name, last name, and email';
      }
    } else if (!form.employeeId) {
      errs.employeeId = 'Employee is required';
    }
    if (!form.caseType) errs.caseType = 'Case type is required';
    setErrors(errs);
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      toast.error(`Please fix: ${Object.values(errs).join(', ')}`);
      return;
    }
    let employeeId = form.employeeId;
    if (newCandidate) {
      try {
        const { employee } = await createEmployee.mutateAsync({
          firstName: newCandidate.firstName.trim(),
          lastName: newCandidate.lastName.trim(),
          email: newCandidate.email.trim(),
          isCandidate: true,
        });
        employeeId = employee.id;
      } catch (err) {
        toast.error(getApiErrorMessage(err).description);
        return;
      }
    }
    let petitionerId = form.petitionerId;
    if (newPetitionerName.trim()) {
      try {
        const created = await createPetitioner.mutateAsync({ name: newPetitionerName.trim() });
        petitionerId = created.id;
      } catch {
        toast.error('Could not create the new petitioner. Please try again.');
        return;
      }
    }
    onSubmit({ ...form, employeeId, petitionerId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select
              value={newCandidate ? '__new_candidate__' : form.employeeId}
              onValueChange={v => {
                if (v === '__new_candidate__') { setNewCandidate({ firstName: '', lastName: '', email: '' }); set('employeeId', ''); }
                else { setNewCandidate(null); set('employeeId', v); }
              }}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}
                  </SelectItem>
                ))}
                {!isEdit && <SelectItem value="__new_candidate__">+ Add new candidate…</SelectItem>}
              </SelectContent>
            </Select>
            {newCandidate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <Input
                  autoFocus
                  value={newCandidate.firstName}
                  onChange={e => setNewCandidate(prev => prev && { ...prev, firstName: e.target.value })}
                  placeholder="First name"
                />
                <Input
                  value={newCandidate.lastName}
                  onChange={e => setNewCandidate(prev => prev && { ...prev, lastName: e.target.value })}
                  placeholder="Last name"
                />
                <Input
                  type="email"
                  value={newCandidate.email}
                  onChange={e => setNewCandidate(prev => prev && { ...prev, email: e.target.value })}
                  placeholder="Email"
                />
                <p className="col-span-1 sm:col-span-3 text-[11px] text-muted-foreground">
                  Creates a minimal employee record — no portal login or welcome email is sent until they're actually hired.
                </p>
              </div>
            )}
            {errors.employeeId && <p className="text-xs text-red-500">{errors.employeeId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Case Type *</Label>
            <Select value={form.caseType} onValueChange={v => set('caseType', v as CaseType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select case type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CASE_TYPE_LABELS) as CaseType[]).map(t => (
                  <SelectItem key={t} value={t}>{CASE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.caseType && <p className="text-xs text-red-500">{errors.caseType}</p>}
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as CaseStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{CASE_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Receipt Number</Label>
            <Input value={form.receiptNumber} onChange={e => set('receiptNumber', e.target.value)} placeholder="e.g. WAC-25-000-00000" />
          </div>

          <div className="space-y-2">
            <Label>Priority Date</Label>
            <UsDateInput value={form.priorityDate} onChange={iso => set('priorityDate', iso)} />
          </div>

          <div className="space-y-2">
            <Label>Filed Date</Label>
            <UsDateInput value={form.filedDate} onChange={iso => set('filedDate', iso)} />
          </div>

          <div className="space-y-2">
            <Label>Decision Date</Label>
            <UsDateInput value={form.decisionDate} onChange={iso => set('decisionDate', iso)} />
          </div>

          <div className="space-y-2">
            <Label>Attorney Name</Label>
            <Input value={form.attorneyName} onChange={e => set('attorneyName', e.target.value)} placeholder="Outside counsel, if any" />
          </div>

          <div className="space-y-2">
            <Label>Classification</Label>
            <Select value={form.classification || undefined} onValueChange={v => set('classification', v)}>
              <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
              <SelectContent>
                {CASE_CLASSIFICATIONS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Petitioner</Label>
            <Select
              value={newPetitionerName ? '__new__' : (form.petitionerId || undefined)}
              onValueChange={v => {
                if (v === '__new__') { setNewPetitionerName(' '); set('petitionerId', ''); }
                else { setNewPetitionerName(''); set('petitionerId', v); }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select petitioner" /></SelectTrigger>
              <SelectContent>
                {(petitioners ?? []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                <SelectItem value="__new__">+ New petitioner…</SelectItem>
              </SelectContent>
            </Select>
            {newPetitionerName && (
              <Input
                autoFocus
                value={newPetitionerName.trim()}
                onChange={e => setNewPetitionerName(e.target.value)}
                placeholder="Petitioner (company) name"
                className="mt-2"
              />
            )}
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What is this case about?"
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" loading={isPending} loadingText={isEdit ? 'Saving…' : 'Creating…'}>
          {isEdit ? 'Save Changes' : 'Create Case'}
        </Button>
      </div>
    </form>
  );
}
