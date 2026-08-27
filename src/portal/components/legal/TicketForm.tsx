import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../hooks/useEmployees';
import { useCases } from '../../hooks/useCases';

interface TicketFormProps {
  onSubmit: (data: { caseId?: string; employeeId?: string; subject: string; message: string }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function TicketForm({ onSubmit, onCancel, isPending = false }: TicketFormProps) {
  const { user } = useAuth();
  // HR can't list Cases (that endpoint is admin/legal-only), so HR always
  // asks "about an employee" — only admin/legal can also link a specific case.
  const canPickCase = user?.role === 'admin' || user?.role === 'legal';

  const { data: empData } = useEmployees({ limit: 500 });
  const { data: caseData } = useCases({ limit: 500 }, { enabled: canPickCase });
  const employees = empData?.data ?? [];
  const cases = canPickCase ? (caseData?.data ?? []) : [];

  const [targetType, setTargetType] = useState<'employee' | 'case'>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === 'employee' && !employeeId) { setError('Select an employee'); return; }
    if (targetType === 'case' && !caseId) { setError('Select a case'); return; }
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (!message.trim()) { setError('Message is required'); return; }
    setError('');
    onSubmit({
      employeeId: targetType === 'employee' ? employeeId : undefined,
      caseId: targetType === 'case' ? caseId : undefined,
      subject: subject.trim(),
      message: message.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          {canPickCase && (
            <div className="space-y-2">
              <Label>This ticket is about *</Label>
              <Select value={targetType} onValueChange={v => setTargetType(v as 'employee' | 'case')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">An employee</SelectItem>
                  <SelectItem value="case">A specific case</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {targetType === 'employee' ? (
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Case *</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                <SelectContent>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayId} — {c.employeeFirstName} {c.employeeLastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Can we expedite this PWD?" />
          </div>

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="resize-y" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="submit" loading={isPending} loadingText="Submitting…">
          Submit Ticket
        </Button>
      </div>
    </form>
  );
}
