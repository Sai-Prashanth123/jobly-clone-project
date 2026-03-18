import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Employee, EmployeeStatus, EmploymentType, PayFrequency, PayType, VisaType, I9Status } from '../../types';

type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'documents'>;

interface EmployeeFormProps {
  initial?: Partial<Employee>;
  onSubmit: (data: EmployeeFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const defaultForm: EmployeeFormData = {
  firstName: '', lastName: '', email: '', phone: '', dob: '',
  address: { street: '', city: '', state: '', zip: '', country: 'USA' },
  department: '', jobTitle: '', employmentType: 'w2', startDate: '',
  status: 'active', payRate: 0, payType: 'hourly', payFrequency: 'biweekly',
};

export function EmployeeForm({ initial, onSubmit, onCancel, isEdit = false }: EmployeeFormProps) {
  const [form, setForm] = useState<EmployeeFormData>({ ...defaultForm, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const setAddr = (field: string, value: string) => {
    setForm(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (form.payRate <= 0) errs.payRate = 'Pay rate must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="immigration">Immigration</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        {/* ── Personal ─────────────────────────────────────────────── */}
        <TabsContent value="personal">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
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
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={form.address.zip} onChange={e => setAddr('zip', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.address.country} onChange={e => setAddr('country', e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Employment ───────────────────────────────────────────── */}
        <TabsContent value="employment">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={v => set('employmentType', v as EmploymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="w2">W-2</SelectItem>
                  <SelectItem value="1099">1099</SelectItem>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as EmployeeStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Immigration ──────────────────────────────────────────── */}
        <TabsContent value="immigration">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visa Type</Label>
              <Select value={form.visaType ?? ''} onValueChange={v => set('visaType', v as VisaType)}>
                <SelectTrigger><SelectValue placeholder="Select visa type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">US Citizen</SelectItem>
                  <SelectItem value="gc">Green Card</SelectItem>
                  <SelectItem value="h1b">H-1B</SelectItem>
                  <SelectItem value="l1">L-1</SelectItem>
                  <SelectItem value="opt">OPT</SelectItem>
                  <SelectItem value="stem_opt">STEM OPT</SelectItem>
                  <SelectItem value="tn">TN</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visa Expiry</Label>
              <Input type="date" value={form.visaExpiry ?? ''} onChange={e => set('visaExpiry', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>I-9 Status</Label>
              <Select value={form.i9Status ?? ''} onValueChange={v => set('i9Status', v as I9Status)}>
                <SelectTrigger><SelectValue placeholder="Select I-9 status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Payroll ──────────────────────────────────────────────── */}
        <TabsContent value="payroll">
          <Card><CardContent className="pt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pay Rate ($/hr or $/yr) *</Label>
              <Input
                type="number" min={0} step={0.01}
                value={form.payRate}
                onChange={e => set('payRate', parseFloat(e.target.value) || 0)}
              />
              {errors.payRate && <p className="text-xs text-red-500">{errors.payRate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select value={form.payType} onValueChange={v => set('payType', v as PayType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay Frequency</Label>
              <Select value={form.payFrequency} onValueChange={v => set('payFrequency', v as PayFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
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
        <Button type="submit">{isEdit ? 'Save Changes' : 'Create Employee'}</Button>
      </div>
    </form>
  );
}
