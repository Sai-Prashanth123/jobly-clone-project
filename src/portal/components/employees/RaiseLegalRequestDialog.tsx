import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRaiseLegalRequest } from '../../hooks/useEmployees';
import { CASE_TYPE_LABELS } from '../legal/CaseForm';
import type { CaseType } from '../../types';

export function RaiseLegalRequestDialog({
  employeeId, employeeName, open, onOpenChange,
}: {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [caseType, setCaseType] = useState<CaseType>('h1b_new');
  const [reason, setReason] = useState('');
  const raiseRequest = useRaiseLegalRequest(employeeId);

  const reset = () => { setCaseType('h1b_new'); setReason(''); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!raiseRequest.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise Request to Legal</DialogTitle>
          <DialogDescription>
            Creates a case for {employeeName} in the Legal team's queue (e.g. an H-1B review, PERM filing, or renewal).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Request type</Label>
            <Select value={caseType} onValueChange={v => setCaseType(v as CaseType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CASE_TYPE_LABELS) as CaseType[]).map(t => (
                  <SelectItem key={t} value={t}>{CASE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={5}
              maxLength={2000}
              placeholder="What does Legal need to do? (e.g. renew H-1B, review visa documents, file PERM)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={raiseRequest.isPending}>
            Cancel
          </Button>
          <Button
            loading={raiseRequest.isPending}
            loadingText="Sending…"
            disabled={!reason.trim()}
            onClick={async () => {
              try {
                const result = await raiseRequest.mutateAsync({ caseType, reason: reason.trim() });
                toast.success(`Request sent to Legal — case ${result.caseDisplayId} created.`);
                onOpenChange(false);
                reset();
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to raise request to Legal');
              }
            }}
          >
            Raise Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
