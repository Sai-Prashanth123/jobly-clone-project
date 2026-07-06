import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Send, RotateCcw } from 'lucide-react';
import type { Timesheet } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UsDateInput } from '../shared/UsDateInput';

const todayStr = () => new Date().toISOString().split('T')[0];

interface TimesheetApprovalActionsProps {
  timesheet: Timesheet;
  onStatusChange: (status: string, rejectionReason?: string) => void;
  isLoading?: boolean;
  onReopen?: (reason?: string) => void;
  isReopening?: boolean;
}

export function TimesheetApprovalActions({ timesheet, onStatusChange, isLoading, onReopen, isReopening }: TimesheetApprovalActionsProps) {
  const { user } = useAuth();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [clientApproveOpen, setClientApproveOpen] = useState(false);
  const [clientRepName, setClientRepName] = useState('');
  const [clientApprovalDate, setClientApprovalDate] = useState(todayStr());
  const [clientNotes, setClientNotes] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  if (!user) return null;

  const canReopen = (user.role === 'admin' || user.role === 'hr' || user.role === 'operations') && !!onReopen;

  const reopenDialog = (
    <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Reopen Timesheet</DialogTitle>
          <DialogDescription>
            This sends the timesheet back to the employee as a draft so they can correct their actual hours and
            resubmit. Any client-signed proof already attached will be cleared, since it attested to the old hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Reason <span className="text-muted-foreground font-normal">(optional, shown to the employee)</span></Label>
          <Textarea
            placeholder="e.g. Employee was out sick during this period — please update actuals."
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setReopenOpen(false)} disabled={isReopening}>Cancel</Button>
          <Button
            loading={isReopening}
            loadingText="Reopening…"
            onClick={() => {
              onReopen?.(reopenReason.trim() || undefined);
              setReopenOpen(false);
              setReopenReason('');
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reopen Timesheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const reopenButton = canReopen && (
    <Button variant="outline" className="gap-2" disabled={isLoading || isReopening} onClick={() => setReopenOpen(true)}>
      <RotateCcw className="h-4 w-4" />
      Reopen
    </Button>
  );

  const { status } = timesheet;
  const role = user.role;

  const isOwnerEmployee = role === 'employee' && user.employeeId === timesheet.employeeId;
  const isAdminOnBehalf = role === 'admin' && user.employeeId !== timesheet.employeeId;

  if ((status === 'draft' || status === 'rejected') && (isOwnerEmployee || role === 'admin')) {
    // A draft with a submittedAt already set was previously submitted and then
    // Reopened (Reopen clears the approval timestamps but not submittedAt) —
    // show "Resubmit" so it's clearly distinguished from a first-time submit,
    // since auto-save alone ("Saved" indicator) is easy to mistake for
    // "already sent to HR" if the actual submit action isn't unambiguous.
    const isResubmit = status === 'rejected' || !!timesheet.submittedAt;
    const label = isResubmit
      ? (isAdminOnBehalf ? 'Resubmit on Behalf' : 'Resubmit Timesheet')
      : (isAdminOnBehalf ? 'Submit on Behalf' : 'Submit Timesheet');
    return (
      <Button className="gap-2" loading={isLoading} loadingText={isResubmit ? 'Resubmitting…' : 'Submitting…'} onClick={() => onStatusChange('submitted')}>
        <Send className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  if ((role === 'operations' || role === 'admin' || role === 'hr') && status === 'submitted') {
    return (
      <>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            disabled={isLoading} onClick={() => setRejectOpen(true)}>
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button className="gap-2" loading={isLoading} loadingText="Approving…"
            onClick={() => setApproveOpen(true)}>
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </div>

        <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Timesheet?</AlertDialogTitle>
              <AlertDialogDescription>This will mark the timesheet as manager-approved and send it for client approval.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setApproveOpen(false); onStatusChange('manager_approved'); }}>Approve</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Reject Timesheet</DialogTitle>
              <DialogDescription className="sr-only">Provide a reason for rejection.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Reason for rejection</Label>
              <Textarea
                placeholder="Please provide a reason..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isLoading}>Cancel</Button>
              <Button
                variant="destructive"
                loading={isLoading}
                loadingText="Rejecting…"
                onClick={() => {
                  onStatusChange('rejected', rejectReason);
                  setRejectOpen(false);
                  setRejectReason('');
                }}
              >
                Reject Timesheet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const canClientApprove = role === 'finance' || role === 'admin' || role === 'hr';
  if (status === 'manager_approved' && (canClientApprove || canReopen)) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {canClientApprove && (
            <Button className="gap-2" loading={isLoading} loadingText="Approving…"
              onClick={() => { setClientApprovalDate(todayStr()); setClientApproveOpen(true); }}>
              <CheckCircle className="h-4 w-4" />
              Client Approve
            </Button>
          )}
          {reopenButton}
        </div>
        <Dialog open={clientApproveOpen} onOpenChange={setClientApproveOpen}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Client Approval</DialogTitle>
              <DialogDescription>Record the client's sign-off on this timesheet before marking it as client-approved.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label>Client representative name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Jane Smith"
                  value={clientRepName}
                  onChange={e => setClientRepName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Approval date</Label>
                <UsDateInput
                  value={clientApprovalDate}
                  onChange={setClientApprovalDate}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Any additional notes from the client…"
                  value={clientNotes}
                  onChange={e => setClientNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClientApproveOpen(false)} disabled={isLoading}>Cancel</Button>
              <Button
                loading={isLoading}
                loadingText="Approving…"
                onClick={() => {
                  setClientApproveOpen(false);
                  onStatusChange('client_approved');
                  setClientRepName('');
                  setClientNotes('');
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Confirm Client Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {reopenDialog}
      </>
    );
  }

  if (status === 'client_approved' && canReopen) {
    return (
      <>
        {reopenButton}
        {reopenDialog}
      </>
    );
  }

  return null;
}
