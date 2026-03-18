import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Send } from 'lucide-react';
import type { Timesheet } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface TimesheetApprovalActionsProps {
  timesheet: Timesheet;
  onUpdate: (id: string, data: Partial<Timesheet>) => void;
}

export function TimesheetApprovalActions({ timesheet, onUpdate }: TimesheetApprovalActionsProps) {
  const { user } = useAuth();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!user) return null;

  const { status } = timesheet;
  const role = user.role;

  // Employee: can submit draft
  if (role === 'employee' && status === 'draft' && user.employeeId === timesheet.employeeId) {
    return (
      <Button
        className="gap-2"
        onClick={() =>
          onUpdate(timesheet.id, {
            status: 'submitted',
            submittedAt: new Date().toISOString(),
          })
        }
      >
        <Send className="h-4 w-4" />
        Submit Timesheet
      </Button>
    );
  }

  // Employee: can resubmit rejected
  if (role === 'employee' && status === 'rejected' && user.employeeId === timesheet.employeeId) {
    return (
      <Button
        className="gap-2"
        onClick={() =>
          onUpdate(timesheet.id, {
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            rejectionReason: undefined,
          })
        }
      >
        <Send className="h-4 w-4" />
        Resubmit Timesheet
      </Button>
    );
  }

  // Manager (operations / admin): can approve/reject submitted
  if ((role === 'operations' || role === 'admin') && status === 'submitted') {
    return (
      <>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setRejectOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button
            className="gap-2"
            onClick={() =>
              onUpdate(timesheet.id, {
                status: 'manager_approved',
                managerApprovedAt: new Date().toISOString(),
              })
            }
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </div>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Timesheet</DialogTitle>
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
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onUpdate(timesheet.id, {
                    status: 'rejected',
                    rejectionReason: rejectReason,
                  });
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

  // Finance / admin: client approve
  if ((role === 'finance' || role === 'admin') && status === 'manager_approved') {
    return (
      <Button
        className="gap-2"
        onClick={() =>
          onUpdate(timesheet.id, {
            status: 'client_approved',
            clientApprovedAt: new Date().toISOString(),
          })
        }
      >
        <CheckCircle className="h-4 w-4" />
        Client Approve
      </Button>
    );
  }

  return null;
}
