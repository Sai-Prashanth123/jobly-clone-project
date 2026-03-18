import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Client } from '../../types';

type ClientFormData = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'documents'>;

interface ClientFormProps {
  initial?: Partial<Client>;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const defaultForm: ClientFormData = {
  companyName: '', contactName: '', contactEmail: '', contactPhone: '', industry: '',
  address: { street: '', city: '', state: '', zip: '', country: 'USA' },
  contractStartDate: '', netPaymentDays: 30, defaultBillRate: 0,
  currency: 'USD', status: 'active',
};

export function ClientForm({ initial, onSubmit, onCancel, isEdit = false }: ClientFormProps) {
  const [form, setForm] = useState<ClientFormData>({ ...defaultForm, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const setAddr = (field: string, value: string) =>
    setForm(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.companyName.trim()) errs.companyName = 'Company name is required';
    if (!form.contactEmail.trim()) errs.contactEmail = 'Contact email is required';
    if (!form.contractStartDate) errs.contractStartDate = 'Contract start date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        {/* ── Basic ────────────────────────────────────────────────── */}
        <TabsContent value="basic">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Company Name *</Label>
              <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} />
              {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={e => set('contactName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
              {errors.contactEmail && <p className="text-xs text-red-500">{errors.contactEmail}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => set('industry', v)}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Other'].map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as 'active' | 'inactive')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Street Address</Label>
              <Input value={form.address.street} onChange={e => setAddr('street', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.address.city} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.address.state} onChange={e => setAddr('state', e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Contract ─────────────────────────────────────────────── */}
        <TabsContent value="contract">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Start Date *</Label>
              <Input type="date" value={form.contractStartDate} onChange={e => set('contractStartDate', e.target.value)} />
              {errors.contractStartDate && <p className="text-xs text-red-500">{errors.contractStartDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contract End Date</Label>
              <Input type="date" value={form.contractEndDate ?? ''} onChange={e => set('contractEndDate', e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Billing ──────────────────────────────────────────────── */}
        <TabsContent value="billing">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Net Payment Days</Label>
              <Input type="number" min={0} value={form.netPaymentDays} onChange={e => set('netPaymentDays', parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-2">
              <Label>Default Bill Rate ($/hr)</Label>
              <Input type="number" min={0} step={0.01} value={form.defaultBillRate} onChange={e => set('defaultBillRate', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="docs">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Document upload functionality coming soon.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{isEdit ? 'Save Changes' : 'Create Client'}</Button>
      </div>
    </form>
  );
}
