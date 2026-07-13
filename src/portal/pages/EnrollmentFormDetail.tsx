import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, Download, CheckCircle2, AlertCircle, Trash2, Plus } from 'lucide-react';
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
import { getApiErrorMessage } from '../lib/apiError';
import {
  useEnrollmentForm, useUpdateEnrollmentForm, useSubmitEnrollmentForm, useGenerateEnrollmentFormPdf,
  CONDITION_CHECKLIST, WAIVER_REASONS, RELATIONSHIP_OPTIONS, COVERAGE_TIERS, ENROLLMENT_TYPES, EMPLOYEE_STATUS_OPTIONS,
  type EnrollmentFormData, type Dependent, type SectionGRow, type PersonHealthGrid,
} from '../hooks/useEnrollmentForms';

const SECTION_H_TEXT = `If you are declining enrollment for yourself or your dependents (including your spouse) because of other health insurance or group health coverage, you may be able to enroll yourself and your dependents in this plan if you or your dependents lose eligibility for that other coverage. You must request enrollment within 30 days after other coverage ends. If you have a new dependent as a result of marriage, birth, adoption, or placement for adoption, you may also be able to enroll. A Special Enrollment Period is also available if you or a dependent lose Medicaid/State child health plan eligibility, or become eligible for such assistance — request must be submitted within 60 days of that event.`;

const SECTION_I_TEXT = `I represent that the statements and answers on this enrollment form are true and complete to the best of my knowledge and belief. I understand these will be used to determine eligibility for coverage for myself and any listed spouse/dependent children, and that any material misrepresentation may be used as a basis for changing rates or terminating coverage. I acknowledge that knowing and willful misstatements in this enrollment form may constitute health care fraud, a criminal violation of 18 US Code Section 1347.`;

const blankDependent = (): Dependent => ({ lastName: '', firstName: '', relationship: '', gender: '', dob: '', ssn: '', tobaccoUse: false });
const blankDetailRow = (): SectionGRow => ({ person: '', condition: '', datesTreated: '', treatment: '', dateLastTaken: '', prognosis: '' });

export default function EnrollmentFormDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: enrollmentForm, isLoading, isError } = useEnrollmentForm(id);
  const updateForm = useUpdateEnrollmentForm(id ?? '');
  const submitForm = useSubmitEnrollmentForm(id ?? '');
  const generatePdf = useGenerateEnrollmentFormPdf();

  const [form, setForm] = useState<EnrollmentFormData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    if (!enrollmentForm) return;
    setForm({
      sectionA: { mailingSameAsHome: true, ...enrollmentForm.formData.sectionA },
      sectionB: { ...enrollmentForm.formData.sectionB },
      sectionD: { coverageTier: '', dependents: [], ...enrollmentForm.formData.sectionD },
      sectionE: { ...enrollmentForm.formData.sectionE },
      sectionF: {
        employee: {}, spouse: {}, conditions: [],
        ...enrollmentForm.formData.sectionF,
      },
      sectionG: enrollmentForm.formData.sectionG ?? [],
      sectionI: { ...enrollmentForm.formData.sectionI },
    });
  }, [enrollmentForm]);

  if (isLoading || !form) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !enrollmentForm) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Failed to load this enrollment form.</p>
      </div>
    );
  }

  const canEdit = user?.role === 'employee' && enrollmentForm.employeeId === user?.employeeId && enrollmentForm.status === 'pending';

  const setA = (patch: Partial<NonNullable<EnrollmentFormData['sectionA']>>) =>
    setForm(prev => (prev ? { ...prev, sectionA: { ...prev.sectionA, ...patch } } : prev));
  const setAAddr = (key: 'homeAddress' | 'mailingAddress', patch: Record<string, string>) =>
    setForm(prev => (prev ? { ...prev, sectionA: { ...prev.sectionA, [key]: { ...prev.sectionA?.[key], ...patch } } } : prev));
  const setB = (patch: Partial<NonNullable<EnrollmentFormData['sectionB']>>) =>
    setForm(prev => (prev ? { ...prev, sectionB: { ...prev.sectionB, ...patch } } : prev));
  const setD = (patch: Partial<NonNullable<EnrollmentFormData['sectionD']>>) =>
    setForm(prev => (prev ? { ...prev, sectionD: { ...prev.sectionD, ...patch } } : prev));
  const setE = (patch: Partial<NonNullable<EnrollmentFormData['sectionE']>>) =>
    setForm(prev => (prev ? { ...prev, sectionE: { ...prev.sectionE, ...patch } } : prev));
  const setF = (patch: Partial<NonNullable<EnrollmentFormData['sectionF']>>) =>
    setForm(prev => (prev ? { ...prev, sectionF: { ...prev.sectionF, ...patch } } : prev));
  const setFPerson = (who: 'employee' | 'spouse', patch: Partial<PersonHealthGrid>) =>
    setForm(prev => (prev ? { ...prev, sectionF: { ...prev.sectionF, [who]: { ...prev.sectionF?.[who], ...patch } } } : prev));
  const setI = (patch: Partial<NonNullable<EnrollmentFormData['sectionI']>>) =>
    setForm(prev => (prev ? { ...prev, sectionI: { ...prev.sectionI, ...patch } } : prev));

  const dependents = form.sectionD?.dependents ?? [];
  const addDependent = () => setD({ dependents: [...dependents, blankDependent()] });
  const removeDependent = (idx: number) => setD({ dependents: dependents.filter((_, i) => i !== idx) });
  const updateDependent = (idx: number, patch: Partial<Dependent>) =>
    setD({ dependents: dependents.map((dep, i) => (i === idx ? { ...dep, ...patch } : dep)) });

  const conditions = form.sectionF?.conditions ?? [];
  const toggleCondition = (label: string) =>
    setF({ conditions: conditions.includes(label) ? conditions.filter(c => c !== label) : [...conditions, label] });

  const detailRows = form.sectionG ?? [];
  const addDetailRow = () => setForm(prev => (prev ? { ...prev, sectionG: [...(prev.sectionG ?? []), blankDetailRow()] } : prev));
  const removeDetailRow = (idx: number) => setForm(prev => (prev ? { ...prev, sectionG: (prev.sectionG ?? []).filter((_, i) => i !== idx) } : prev));
  const updateDetailRow = (idx: number, patch: Partial<SectionGRow>) =>
    setForm(prev => (prev ? { ...prev, sectionG: (prev.sectionG ?? []).map((row, i) => (i === idx ? { ...row, ...patch } : row)) } : prev));

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateForm.mutateAsync(form);
      toast.success('Draft saved');
    } catch {
      toast.error('Could not save draft');
    }
  };

  const handleSubmit = async () => {
    if (!form) return;
    try {
      await submitForm.mutateAsync(form);
      setSubmitOpen(false);
      toast.success('Enrollment form submitted');
    } catch (e) {
      toast.error(getApiErrorMessage(e).description);
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

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader
        eyebrow="Enrollment Forms"
        title={enrollmentForm.employeeName ?? enrollmentForm.displayId}
        description={`${enrollmentForm.displayId} · ${enrollmentForm.status === 'pending' ? 'Pending — awaiting employee' : `Submitted ${enrollmentForm.submittedAt ? new Date(enrollmentForm.submittedAt).toLocaleDateString() : ''}`}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/portal/enrollment-forms')} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={handleSave} disabled={updateForm.isPending} className="gap-1.5">
                {updateForm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={generatePdf.isPending} className="gap-1.5">
              {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setSubmitOpen(true)} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Submit
              </Button>
            )}
          </div>
        }
      />

      {/* Section A — Employee info */}
      <Card>
        <CardHeader><CardTitle className="text-base">A — Employee (Primary Applicant)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.sectionA?.lastName ?? ''} onChange={e => setA({ lastName: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>First Name</Label><Input value={form.sectionA?.firstName ?? ''} onChange={e => setA({ firstName: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>MI</Label><Input value={form.sectionA?.mi ?? ''} onChange={e => setA({ mi: e.target.value })} disabled={!canEdit} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Social Security Number</Label><Input value={form.sectionA?.ssn ?? ''} onChange={e => setA({ ssn: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.sectionA?.gender || '__none'} onValueChange={v => setA({ gender: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Birth Date</Label><UsDateInput value={form.sectionA?.birthDate ?? ''} onChange={v => setA({ birthDate: v })} disabled={!canEdit} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Avg. Hours Worked / Week</Label><Input value={form.sectionA?.avgHoursWeek ?? ''} onChange={e => setA({ avgHoursWeek: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Date Employed Full-Time</Label><UsDateInput value={form.sectionA?.dateEmployedFullTime ?? ''} onChange={v => setA({ dateEmployedFullTime: v })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Job Title</Label><Input value={form.sectionA?.jobTitle ?? ''} onChange={e => setA({ jobTitle: e.target.value })} disabled={!canEdit} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5"><Label>Home Street</Label><Input value={form.sectionA?.homeAddress?.street ?? ''} onChange={e => setAAddr('homeAddress', { street: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={form.sectionA?.homeAddress?.city ?? ''} onChange={e => setAAddr('homeAddress', { city: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>State</Label><Input value={form.sectionA?.homeAddress?.state ?? ''} onChange={e => setAAddr('homeAddress', { state: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Zip</Label><Input value={form.sectionA?.homeAddress?.zip ?? ''} onChange={e => setAAddr('homeAddress', { zip: e.target.value })} disabled={!canEdit} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!form.sectionA?.mailingSameAsHome} onCheckedChange={v => setA({ mailingSameAsHome: !!v })} disabled={!canEdit} />
            Mailing address same as home address
          </label>
          {!form.sectionA?.mailingSameAsHome && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5"><Label>Mailing Street</Label><Input value={form.sectionA?.mailingAddress?.street ?? ''} onChange={e => setAAddr('mailingAddress', { street: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>City</Label><Input value={form.sectionA?.mailingAddress?.city ?? ''} onChange={e => setAAddr('mailingAddress', { city: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>State</Label><Input value={form.sectionA?.mailingAddress?.state ?? ''} onChange={e => setAAddr('mailingAddress', { state: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>Zip</Label><Input value={form.sectionA?.mailingAddress?.zip ?? ''} onChange={e => setAAddr('mailingAddress', { zip: e.target.value })} disabled={!canEdit} /></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Home Phone</Label><Input value={form.sectionA?.homePhone ?? ''} onChange={e => setA({ homePhone: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Cell Phone</Label><Input value={form.sectionA?.cellPhone ?? ''} onChange={e => setA({ cellPhone: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Work Phone</Label><Input value={form.sectionA?.workPhone ?? ''} onChange={e => setA({ workPhone: e.target.value })} disabled={!canEdit} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.sectionA?.email ?? ''} onChange={e => setA({ email: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Best Time to Call</Label><Input value={form.sectionA?.bestTimeToCall ?? ''} onChange={e => setA({ bestTimeToCall: e.target.value })} disabled={!canEdit} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Marital Status</Label>
              <Select value={form.sectionA?.maritalStatus || '__none'} onValueChange={v => setA({ maritalStatus: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employee Status</Label>
              <Select value={form.sectionA?.employeeStatus || '__none'} onValueChange={v => setA({ employeeStatus: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {EMPLOYEE_STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Earnings Basis</Label>
              <Select value={form.sectionA?.earningsBasis || '__none'} onValueChange={v => setA({ earningsBasis: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="Salaried">Salaried</SelectItem>
                  <SelectItem value="Hourly">Hourly</SelectItem>
                  <SelectItem value="Commission">Commission</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Enrollment Type</Label>
              <Select value={form.sectionA?.enrollmentType || '__none'} onValueChange={v => setA({ enrollmentType: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {ENROLLMENT_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.sectionA?.enrollmentType === 'Qualifying Life Event' && (
              <div className="space-y-1.5"><Label>Qualifying Event Date</Label><UsDateInput value={form.sectionA?.qualifyingEventDate ?? ''} onChange={v => setA({ qualifyingEventDate: v })} disabled={!canEdit} /></div>
            )}
            {form.sectionA?.enrollmentType === 'COBRA' && (
              <div className="space-y-1.5"><Label>COBRA Effective Date</Label><UsDateInput value={form.sectionA?.cobraEffectiveDate ?? ''} onChange={v => setA({ cobraEffectiveDate: v })} disabled={!canEdit} /></div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section B — Waiver of coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B — Waiver of Coverage</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Only complete this section if waiving any or all coverage.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Waiver Reason</Label>
              <Select value={form.sectionB?.waiverReason || '__none'} onValueChange={v => setB({ waiverReason: v === '__none' ? '' : v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Not waiving coverage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {WAIVER_REASONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.sectionB?.waiverReason === 'Other' && (
              <div className="space-y-1.5"><Label>Other Reason</Label><Input value={form.sectionB?.waiverReasonOther ?? ''} onChange={e => setB({ waiverReasonOther: e.target.value })} disabled={!canEdit} /></div>
            )}
          </div>
          {form.sectionB?.waiverReason && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Signature (type full name)</Label><Input value={form.sectionB?.signatureName ?? ''} onChange={e => setB({ signatureName: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>Date</Label><UsDateInput value={form.sectionB?.signatureDate ?? ''} onChange={v => setB({ signatureDate: v })} disabled={!canEdit} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section D — Persons to be covered */}
      <Card>
        <CardHeader><CardTitle className="text-base">D — Persons to Be Covered</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-sm">
            <Label>Coverage Tier</Label>
            <Select value={form.sectionD?.coverageTier || '__none'} onValueChange={v => setD({ coverageTier: v === '__none' ? '' : v })} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {COVERAGE_TIERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {dependents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No dependents added.</p>
          ) : (
            <div className="space-y-3">
              {dependents.map((dep, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 bg-gray-50/60 rounded-md">
                  <div><Label className="text-[11px]">Last Name</Label><Input value={dep.lastName ?? ''} onChange={e => updateDependent(idx, { lastName: e.target.value })} disabled={!canEdit} /></div>
                  <div><Label className="text-[11px]">First Name</Label><Input value={dep.firstName ?? ''} onChange={e => updateDependent(idx, { firstName: e.target.value })} disabled={!canEdit} /></div>
                  <div>
                    <Label className="text-[11px]">Relationship</Label>
                    <Select value={dep.relationship || '__none'} onValueChange={v => updateDependent(idx, { relationship: v === '__none' ? '' : v })} disabled={!canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {RELATIONSHIP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Gender</Label>
                    <Select value={dep.gender || '__none'} onValueChange={v => updateDependent(idx, { gender: v === '__none' ? '' : v })} disabled={!canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="__none">—</SelectItem><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[11px]">Date of Birth</Label><UsDateInput value={dep.dob ?? ''} onChange={v => updateDependent(idx, { dob: v })} disabled={!canEdit} /></div>
                  <div><Label className="text-[11px]">SSN</Label><Input value={dep.ssn ?? ''} onChange={e => updateDependent(idx, { ssn: e.target.value })} disabled={!canEdit} /></div>
                  <div className="sm:col-span-5">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!dep.tobaccoUse} onCheckedChange={v => updateDependent(idx, { tobaccoUse: !!v })} disabled={!canEdit} />
                      Tobacco use
                    </label>
                  </div>
                  {canEdit && (
                    <div className="sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDependent(idx)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={addDependent} className="gap-2">
              <Plus className="h-4 w-4" /> Add Dependent
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section E — Additional insurance */}
      <Card>
        <CardHeader><CardTitle className="text-base">E — Additional Insurance Coverage Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!form.sectionE?.currentPlanActive} onCheckedChange={v => setE({ currentPlanActive: !!v })} disabled={!canEdit} />
            Will any current medical plan remain active if this coverage is approved?
          </label>
          {form.sectionE?.currentPlanActive && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>For Whom</Label><Input value={form.sectionE?.currentPlanFor ?? ''} onChange={e => setE({ currentPlanFor: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>Carrier</Label><Input value={form.sectionE?.currentPlanCarrier ?? ''} onChange={e => setE({ currentPlanCarrier: e.target.value })} disabled={!canEdit} /></div>
              <div className="space-y-1.5"><Label>ID / Group Number</Label><Input value={form.sectionE?.currentPlanId ?? ''} onChange={e => setE({ currentPlanId: e.target.value })} disabled={!canEdit} /></div>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionE?.medicareA} onCheckedChange={v => setE({ medicareA: !!v })} disabled={!canEdit} /> Medicare Part A</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionE?.medicareB} onCheckedChange={v => setE({ medicareB: !!v })} disabled={!canEdit} /> Medicare Part B</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionE?.medicareD} onCheckedChange={v => setE({ medicareD: !!v })} disabled={!canEdit} /> Medicare Part D</label>
          </div>
          {(form.sectionE?.medicareA || form.sectionE?.medicareB || form.sectionE?.medicareD) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>For Whom</Label><Input value={form.sectionE?.medicareFor ?? ''} onChange={e => setE({ medicareFor: e.target.value })} disabled={!canEdit} /></div>
              <label className="flex items-center gap-2 text-sm self-end pb-2">
                <Checkbox checked={!!form.sectionE?.medicareRemainsActive} onCheckedChange={v => setE({ medicareRemainsActive: !!v })} disabled={!canEdit} />
                Remains active if this coverage is approved?
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section F — Medical history */}
      <Card>
        <CardHeader><CardTitle className="text-base">F — Medical History</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['employee', 'spouse'] as const).map(who => {
              const grid = form.sectionF?.[who];
              return (
                <div key={who} className="p-3 bg-gray-50/60 rounded-md space-y-2">
                  <p className="text-sm font-medium capitalize">{who}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[11px]">Height</Label><Input value={grid?.height ?? ''} onChange={e => setFPerson(who, { height: e.target.value })} disabled={!canEdit} /></div>
                    <div><Label className="text-[11px]">Weight</Label><Input value={grid?.weight ?? ''} onChange={e => setFPerson(who, { weight: e.target.value })} disabled={!canEdit} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!grid?.motorcycle} onCheckedChange={v => setFPerson(who, { motorcycle: !!v })} disabled={!canEdit} /> Owns a motorcycle</label>
                  <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!grid?.movingViolation} onCheckedChange={v => setFPerson(who, { movingViolation: !!v })} disabled={!canEdit} /> Moving violation in last year</label>
                  <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!grid?.dui} onCheckedChange={v => setFPerson(who, { dui: !!v })} disabled={!canEdit} /> DUI/OWI in last 5 years</label>
                </div>
              );
            })}
          </div>

          <div>
            <Label className="mb-2 block">Have you or any dependent, within the past 5 years, received treatment, testing, or a diagnosis for any of the following?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 max-h-80 overflow-y-auto p-3 border rounded-md">
              {CONDITION_CHECKLIST.map(label => (
                <label key={label} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={conditions.includes(label)} onCheckedChange={() => toggleCondition(label)} disabled={!canEdit} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionF?.otherUndiagnosed} onCheckedChange={v => setF({ otherUndiagnosed: !!v })} disabled={!canEdit} /> Diagnosed/treated for a condition not listed above in the last 5 years</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionF?.advisedFutureTreatment} onCheckedChange={v => setF({ advisedFutureTreatment: !!v })} disabled={!canEdit} /> Advised of possible future hospitalization, treatment, testing, or surgery</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionF?.medicationsLast18Months} onCheckedChange={v => setF({ medicationsLast18Months: !!v })} disabled={!canEdit} /> Medications prescribed in the past 18 months</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.sectionF?.currentlyPregnant} onCheckedChange={v => setF({ currentlyPregnant: !!v })} disabled={!canEdit} /> Currently pregnant</label>
          </div>

          {form.sectionF?.currentlyPregnant && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50/60 rounded-md">
              <div className="space-y-1.5"><Label>Due Date</Label><UsDateInput value={form.sectionF?.dueDate ?? ''} onChange={v => setF({ dueDate: v })} disabled={!canEdit} /></div>
              <div className="space-y-2 self-end">
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!form.sectionF?.cSection} onCheckedChange={v => setF({ cSection: !!v })} disabled={!canEdit} /> C-section anticipated</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!form.sectionF?.multiples} onCheckedChange={v => setF({ multiples: !!v })} disabled={!canEdit} /> Multiple births expected</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!form.sectionF?.pregnancyComplications} onCheckedChange={v => setF({ pregnancyComplications: !!v })} disabled={!canEdit} /> Complications anticipated</label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section G — Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">G — Details</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Provide full details for any condition checked in Section F.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {detailRows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No details added.</p>
          ) : (
            <div className="space-y-3">
              {detailRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 bg-gray-50/60 rounded-md">
                  <div><Label className="text-[11px]">Person</Label><Input value={row.person ?? ''} onChange={e => updateDetailRow(idx, { person: e.target.value })} disabled={!canEdit} /></div>
                  <div><Label className="text-[11px]">Condition</Label><Input value={row.condition ?? ''} onChange={e => updateDetailRow(idx, { condition: e.target.value })} disabled={!canEdit} /></div>
                  <div><Label className="text-[11px]">Dates Treated</Label><Input value={row.datesTreated ?? ''} onChange={e => updateDetailRow(idx, { datesTreated: e.target.value })} disabled={!canEdit} /></div>
                  <div className="sm:col-span-2"><Label className="text-[11px]">Treatment / Medication</Label><Input value={row.treatment ?? ''} onChange={e => updateDetailRow(idx, { treatment: e.target.value })} disabled={!canEdit} /></div>
                  <div><Label className="text-[11px]">Date Last Taken</Label><Input value={row.dateLastTaken ?? ''} onChange={e => updateDetailRow(idx, { dateLastTaken: e.target.value })} disabled={!canEdit} /></div>
                  <div className="sm:col-span-5"><Label className="text-[11px]">Prognosis</Label><Input value={row.prognosis ?? ''} onChange={e => updateDetailRow(idx, { prognosis: e.target.value })} disabled={!canEdit} /></div>
                  {canEdit && (
                    <div className="sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDetailRow(idx)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={addDetailRow} className="gap-2">
              <Plus className="h-4 w-4" /> Add Detail Row
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section H — Federal mandates notice (static) */}
      <Card>
        <CardHeader><CardTitle className="text-base">H — Notice of Federal Mandates</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{SECTION_H_TEXT}</p>
        </CardContent>
      </Card>

      {/* Section I — Authorization & signature */}
      <Card>
        <CardHeader><CardTitle className="text-base">I — Application Authorization and Signature</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{SECTION_I_TEXT}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Signature (type full name)</Label><Input value={form.sectionI?.signatureName ?? ''} onChange={e => setI({ signatureName: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-1.5"><Label>Date</Label><UsDateInput value={form.sectionI?.signatureDate ?? ''} onChange={v => setI({ signatureDate: v })} disabled={!canEdit} /></div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="w-[95vw] max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Submit Enrollment Form</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Submitting locks this form — you won't be able to make further changes. HR will be notified.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitForm.isPending}>
              {submitForm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
