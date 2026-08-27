import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import type { CaseFiling, FilingType, FilingStatus } from '../../types';
import { UsDateInput } from '../shared/UsDateInput';

const FILING_TYPE_LABELS: Record<FilingType, string> = {
  cap_registration: 'CAP Registration (H-1B Lottery)',
  pwd: 'PWD (Prevailing Wage Determination)',
};

const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  draft: 'Draft',
  filed: 'Filed',
  certified: 'Certified',
  selected: 'Selected',
  not_selected: 'Not Selected',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

type FilingFormData = {
  filingType: FilingType | '';
  status: FilingStatus;
  referenceNumber: string;
  filedDate: string;
  decisionDate: string;
  notes: string;
  // CAP-specific
  lotteryYear: string;
  capSeason: string;
  // PWD-specific
  socCode: string;
  wageLevel: string;
  prevailingWageAmount: string;
  worksiteAddress: string;
};

const defaultForm: FilingFormData = {
  filingType: '', status: 'draft', referenceNumber: '', filedDate: '', decisionDate: '', notes: '',
  lotteryYear: '', capSeason: '', socCode: '', wageLevel: '', prevailingWageAmount: '', worksiteAddress: '',
};

interface FilingFormProps {
  initial?: CaseFiling;
  onSubmit: (data: {
    filingType: string;
    status: string;
    referenceNumber?: string;
    filedDate?: string;
    decisionDate?: string;
    notes?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: Record<string, any>;
  }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function FilingForm({ initial, onSubmit, onCancel, isPending = false }: FilingFormProps) {
  const seed = (src?: CaseFiling): FilingFormData => ({
    filingType: src?.filingType ?? '',
    status: src?.status ?? 'draft',
    referenceNumber: src?.referenceNumber ?? '',
    filedDate: src?.filedDate ?? '',
    decisionDate: src?.decisionDate ?? '',
    notes: src?.notes ?? '',
    lotteryYear: src?.details?.lotteryYear ?? '',
    capSeason: src?.details?.capSeason ?? '',
    socCode: src?.details?.socCode ?? '',
    wageLevel: src?.details?.wageLevel ?? '',
    prevailingWageAmount: src?.details?.prevailingWageAmount ?? '',
    worksiteAddress: src?.details?.worksiteAddress ?? '',
  });

  const [form, setForm] = useState<FilingFormData>(seed(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(seed(initial));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const set = <K extends keyof FilingFormData>(field: K, value: FilingFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.filingType) {
      setErrors({ filingType: 'Filing type is required' });
      toast.error('Please select a filing type');
      return;
    }
    const details: Record<string, string> = form.filingType === 'cap_registration'
      ? { lotteryYear: form.lotteryYear, capSeason: form.capSeason }
      : { socCode: form.socCode, wageLevel: form.wageLevel, prevailingWageAmount: form.prevailingWageAmount, worksiteAddress: form.worksiteAddress };

    onSubmit({
      filingType: form.filingType,
      status: form.status,
      referenceNumber: form.referenceNumber || undefined,
      filedDate: form.filedDate || undefined,
      decisionDate: form.decisionDate || undefined,
      notes: form.notes || undefined,
      details,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Filing Type *</Label>
            <Select value={form.filingType} onValueChange={v => set('filingType', v as FilingType)} disabled={!!initial}>
              <SelectTrigger><SelectValue placeholder="Select filing type" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FILING_TYPE_LABELS) as FilingType[]).map(t => (
                  <SelectItem key={t} value={t}>{FILING_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.filingType && <p className="text-xs text-red-500">{errors.filingType}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as FilingStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{FILING_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input
              value={form.referenceNumber}
              onChange={e => set('referenceNumber', e.target.value)}
              placeholder={form.filingType === 'pwd' ? 'DOL/ETA case number' : 'CAP registration number'}
            />
          </div>

          <div className="space-y-2">
            <Label>Filed Date</Label>
            <UsDateInput value={form.filedDate} onChange={iso => set('filedDate', iso)} />
          </div>

          <div className="space-y-2">
            <Label>Decision Date</Label>
            <UsDateInput value={form.decisionDate} onChange={iso => set('decisionDate', iso)} />
          </div>

          {form.filingType === 'cap_registration' && (
            <>
              <div className="space-y-2">
                <Label>Lottery Year</Label>
                <Input value={form.lotteryYear} onChange={e => set('lotteryYear', e.target.value)} placeholder="e.g. FY2027" />
              </div>
              <div className="space-y-2">
                <Label>Cap Season</Label>
                <Input value={form.capSeason} onChange={e => set('capSeason', e.target.value)} placeholder="e.g. Regular Cap" />
              </div>
            </>
          )}

          {form.filingType === 'pwd' && (
            <>
              <div className="space-y-2">
                <Label>SOC Code</Label>
                <Input value={form.socCode} onChange={e => set('socCode', e.target.value)} placeholder="e.g. 15-1252" />
              </div>
              <div className="space-y-2">
                <Label>Wage Level</Label>
                <Select value={form.wageLevel || undefined} onValueChange={v => set('wageLevel', v)}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">Level I</SelectItem>
                    <SelectItem value="II">Level II</SelectItem>
                    <SelectItem value="III">Level III</SelectItem>
                    <SelectItem value="IV">Level IV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prevailing Wage Amount</Label>
                <Input value={form.prevailingWageAmount} onChange={e => set('prevailingWageAmount', e.target.value)} placeholder="e.g. 120000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Worksite Address</Label>
                <Input value={form.worksiteAddress} onChange={e => set('worksiteAddress', e.target.value)} />
              </div>
            </>
          )}

          <div className="col-span-1 sm:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="resize-none" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" loading={isPending} loadingText={initial ? 'Saving…' : 'Adding…'}>
          {initial ? 'Save Changes' : 'Add Filing'}
        </Button>
      </div>
    </form>
  );
}
