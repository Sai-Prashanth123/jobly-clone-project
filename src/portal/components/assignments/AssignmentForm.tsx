import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { Assignment, AssignmentStatus, BillingType } from '../../types';
import { useEmployees } from '../../hooks/useEmployees';
import { useClients } from '../../hooks/useClients';

type AssignmentFormData = Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>;

interface AssignmentFormProps {
  initial?: Partial<Assignment>;
  onSubmit: (data: AssignmentFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
  isPending?: boolean;
}

const defaultForm: AssignmentFormData = {
  employeeId: '', clientId: '', projectName: '', role: '',
  startDate: '', billRate: 0, payRate: 0, maxHoursPerWeek: 40, status: 'active',
};

export function AssignmentForm({ initial, onSubmit, onCancel, isEdit = false, isPending = false }: AssignmentFormProps) {
  const { data: empData } = useEmployees({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });
  const [form, setForm] = useState<AssignmentFormData>({ ...defaultForm, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const employees = empData?.data ?? [];
  const clients = clientData?.data ?? [];

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.employeeId) errs.employeeId = 'Employee is required';
    if (!form.clientId) errs.clientId = 'Client is required';
    if (!form.projectName.trim()) errs.projectName = 'Project name is required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (form.billRate <= 0) errs.billRate = 'Bill rate must be greater than 0';
    if (form.payRate <= 0) errs.payRate = 'Pay rate must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  const activeEmployees = employees.filter(e => e.status === 'active' || e.status === 'onboarding');
  const activeClients = clients.filter(c => c.status === 'active');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={form.employeeId} onValueChange={v => set('employeeId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.employeeId && <p className="text-xs text-red-500">{errors.employeeId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={form.clientId} onValueChange={v => set('clientId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {activeClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && <p className="text-xs text-red-500">{errors.clientId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input value={form.projectName} onChange={e => set('projectName', e.target.value)} />
            {errors.projectName && <p className="text-xs text-red-500">{errors.projectName}</p>}
          </div>

          <div className="space-y-2">
            <Label>Role / Position</Label>
            <Input value={form.role} onChange={e => set('role', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={form.endDate ?? ''} onChange={e => set('endDate', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Bill Rate ($/hr) *</Label>
            <Input
              type="number" min={0} step={0.01}
              value={form.billRate}
              onChange={e => set('billRate', parseFloat(e.target.value) || 0)}
            />
            {errors.billRate && <p className="text-xs text-red-500">{errors.billRate}</p>}
          </div>

          <div className="space-y-2">
            <Label>Pay Rate ($/hr) *</Label>
            <Input
              type="number" min={0} step={0.01}
              value={form.payRate}
              onChange={e => set('payRate', parseFloat(e.target.value) || 0)}
            />
            {errors.payRate && <p className="text-xs text-red-500">{errors.payRate}</p>}
          </div>

          <div className="space-y-2">
            <Label>Max Hours / Week</Label>
            <Input
              type="number" min={1} max={60}
              value={form.maxHoursPerWeek}
              onChange={e => set('maxHoursPerWeek', parseInt(e.target.value) || 40)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as AssignmentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Billing Type</Label>
            <Select value={form.billingType ?? ''} onValueChange={v => set('billingType', v as BillingType || undefined)}>
              <SelectTrigger><SelectValue placeholder="Select billing type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Work Location</Label>
            <Input
              value={form.workLocation ?? ''}
              onChange={e => set('workLocation', e.target.value)}
              placeholder="e.g. Remote, Onsite, Hybrid"
            />
          </div>

          <div className="col-span-1 sm:col-span-2 space-y-2">
            <Label>Reporting Manager</Label>
            <Select value={form.reportingManagerId ?? '__none__'} onValueChange={v => set('reportingManagerId', v === '__none__' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {employees.filter(e => e.status === 'active').map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button
          type="submit"
          loading={isPending}
          loadingText={isEdit ? 'Saving…' : 'Creating…'}
        >
          {isEdit ? 'Save Changes' : 'Create Assignment'}
        </Button>
      </div>
    </form>
  );
}
