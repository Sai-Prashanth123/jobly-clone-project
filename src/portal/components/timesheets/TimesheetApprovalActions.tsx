import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Send } from 'lucide-react';
import type { Timesheet } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface TimesheetApprovalActionsProps {
  timesheet: Timesheet;
  onStatusChange: (status: string, rejectionReason?: string) => void;
  isLoading?: boolean;
}

export function TimesheetApprovalActions({ timesheet, onStatusChange, isLoading }: TimesheetApprovalActionsProps) {
  const { user } = useAuth();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [clientApproveOpen, setClientApproveOpen] = useState(false);

  if (!user) return null;

  const { status } = timesheet;
  const role = user.role;

  if (role === 'employee' && status === 'draft' && user.employeeId === timesheet.employeeId) {
    return (
      <Button className="gap-2" loading={isLoading} loadingText="Submitting…" onClick={() => onStatusChange('submitted')}>
        <Send className="h-4 w-4" />
        Submit Timesheet
      </Button>
    );
  }

  if (role === 'employee' && status === 'rejected' && user.employeeId === timesheet.employeeId) {
    return (
      <Button className="gap-2" loading={isLoading} loadingText="Resubmitting…" onClick={() => onStatusChange('submitted')}>
        <Send className="h-4 w-4" />
        Resubmit Timesheet
      </Button>
    );
  }

  if ((role === 'operations' || role === 'admin') && status === 'submitted') {
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

  if ((role === 'finance' || role === 'admin') && status === 'manager_approved') {
    return (
      <>
        <Button className="gap-2" loading={isLoading} loadingText="Approving…"
          onClick={() => setClientApproveOpen(true)}>
          <CheckCircle className="h-4 w-4" />
          Client Approve
        </Button>
        <AlertDialog open={clientApproveOpen} onOpenChange={setClientApproveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Client-Approve Timesheet?</AlertDialogTitle>
              <AlertDialogDescription>This will mark the timesheet as client-approved and make it available for invoicing.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setClientApproveOpen(false); onStatusChange('client_approved'); }}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return null;
}
