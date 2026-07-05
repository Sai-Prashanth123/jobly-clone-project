import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import { EntityAuditTrail } from '../components/shared/EntityAuditTrail';
import { useAssignment, useUpdateAssignment, useDeleteAssignment } from '../hooks/useAssignments';
import { useEmployee } from '../hooks/useEmployees';
import { useClient } from '../hooks/useClients';
import { useTimesheets } from '../hooks/useTimesheets';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: assignment, isLoading } = useAssignment(id);
  const { data: employee } = useEmployee(assignment?.employeeId);
  const { data: client } = useClient(assignment?.clientId);
  const { data: timesheetsData } = useTimesheets({ employeeId: assignment?.employeeId, limit: 100 });
  const updateAssignment = useUpdateAssignment(id!);
  const deleteAssignment = useDeleteAssignment();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!assignment) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Assignment not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/assignments')}>← Back</Button>
      </div>
    );
  }

  const asnTimesheets = (timesheetsData?.data ?? []).filter(t => t.assignmentId === id);
  const totalHours = asnTimesheets.reduce((s, t) => s + t.totalHours, 0);
  const totalBilled = totalHours * assignment.billRate;
  const canEdit = user?.role === 'admin' || user?.role === 'operations';
  // Bill Rate / Total Billable are revenue-side figures — hidden from employees
  // only (operations needs them for assignment management). Pay Rate is a
  // compensation-side figure — hidden from employees AND operations.
  const showBillable = user?.role !== 'employee';
  const showPayRate = user?.role !== 'employee' && user?.role !== 'operations';

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/assignments')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{assignment.projectName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{assignment.displayId ?? assignment.id.slice(0,8)}</span>
              <StatusBadge status={assignment.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {assignment.employeeEmail && (
            <a href={`mailto:${assignment.employeeEmail}?subject=Re: Assignment ${assignment.displayId ?? ''}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Employee
              </Button>
            </a>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
          {/* DELETE /assignments/:id is admin-only on the backend — don't show
              operations a button that will always 403. */}
          {user?.role === 'admin' && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
              className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Assignment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Employee" value={employee ? `${employee.firstName} ${employee.lastName}` : (assignment.employeeName ?? `${assignment.employeeId.slice(0,8)} (removed)`)} />
            <Field label="Client" value={client?.companyName ?? assignment.clientName ?? assignment.clientId.slice(0,8)} />
            <Field label="Project" value={assignment.projectName} />
            <Field label="Role" value={assignment.role} />
            <Field label="Start Date" value={formatDate(assignment.startDate)} />
            <Field label="End Date" value={assignment.endDate ? formatDate(assignment.endDate) : 'Ongoing'} />
            <Field label="Max Hours/Week" value={`${assignment.maxHoursPerWeek} hrs`} />
            {assignment.billingType && <Field label="Billing Type" value={assignment.billingType.charAt(0).toUpperCase() + assignment.billingType.slice(1)} />}
            {assignment.workLocation && <Field label="Work Location" value={assignment.workLocation} />}
            {assignment.reportingManagerName && <Field label="Reporting Manager" value={assignment.reportingManagerName} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {showBillable && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalBilled)}</p>
                <p className="text-xs text-blue-600">Total Billable</p>
              </div>
            )}
            <div className={`grid grid-cols-1 ${showBillable ? 'sm:grid-cols-2' : ''} gap-3`}>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold">{totalHours}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
              {showBillable && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-bold">{formatCurrency(assignment.billRate)}</p>
                  <p className="text-xs text-muted-foreground">Bill Rate/hr</p>
                </div>
              )}
            </div>
            {showPayRate && (
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-sm font-bold">{formatCurrency(assignment.payRate)}</p>
                <p className="text-xs text-muted-foreground">Pay Rate/hr</p>
              </div>
            )}
          </CardContent>
        </Card>

        {assignment.notes && (
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Created By" value={assignment.createdByName ?? '—'} />
            <Field label="Created At" value={formatDate(assignment.createdAt)} />
            {assignment.updatedByName && (
              <>
                <Field label="Last Edited By" value={assignment.updatedByName} />
                <Field label="Last Edited At" value={formatDate(assignment.updatedAt)} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Timesheets ({asnTimesheets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {asnTimesheets.slice(0, 10).map(ts => (
                <div key={ts.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">Week of {ts.weekStartDate}</p>
                    <p className="text-xs text-muted-foreground">{ts.weekStartDate} – {ts.weekEndDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{ts.totalHours} hrs</span>
                    <StatusBadge status={ts.status} />
                  </div>
                </div>
              ))}
              {asnTimesheets.length === 0 && (
                <p className="text-sm text-muted-foreground">No timesheets for this assignment.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityAuditTrail entityType="assignment" entityId={assignment.id} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Assignment — {assignment.displayId ?? assignment.id.slice(0,8)}</DialogTitle>
            <DialogDescription className="sr-only">Update assignment details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <AssignmentForm
              initial={assignment}
              isEdit
              onSubmit={async data => {
                try {
                  await updateAssignment.mutateAsync(data as any);
                  toast.success('Assignment updated');
                  setEditOpen(false);
                } catch {
                  /* failed-request toast raised centrally (queryClient.ts) */
                }
              }}
              onCancel={() => setEditOpen(false)}
              isPending={updateAssignment.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Assignment?"
        description="This will permanently remove this assignment."
        confirmLabel="Delete"
        loading={deleteAssignment.isPending}
        onConfirm={async () => {
          try {
            await deleteAssignment.mutateAsync(assignment.id);
            toast.success('Assignment deleted');
            setDeleteOpen(false);
            navigate('/portal/assignments');
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
          }
        }}
      />
    </div>
  );
}
