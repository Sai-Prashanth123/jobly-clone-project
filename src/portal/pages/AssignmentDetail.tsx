import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import { usePortalData } from '../hooks/usePortalData';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { assignments, updateAssignment, deleteAssignment, employees, clients, timesheets } = usePortalData();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const assignment = assignments.find(a => a.id === id);
  if (!assignment) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Assignment not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/assignments')}>← Back</Button>
      </div>
    );
  }

  const employee = employees.find(e => e.id === assignment.employeeId);
  const client = clients.find(c => c.id === assignment.clientId);
  const asnTimesheets = timesheets.filter(t => t.assignmentId === id);
  const totalHours = asnTimesheets.reduce((s, t) => s + t.totalHours, 0);
  const totalBilled = totalHours * assignment.billRate;

  const canEdit = user?.role === 'admin' || user?.role === 'operations';

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/assignments')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{assignment.projectName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{assignment.id}</span>
              <StatusBadge status={assignment.status} />
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
              className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Assignment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Employee" value={employee ? `${employee.firstName} ${employee.lastName}` : assignment.employeeId} />
            <Field label="Client" value={client?.companyName ?? assignment.clientId} />
            <Field label="Project" value={assignment.projectName} />
            <Field label="Role" value={assignment.role} />
            <Field label="Start Date" value={formatDate(assignment.startDate)} />
            <Field label="End Date" value={assignment.endDate ? formatDate(assignment.endDate) : 'Ongoing'} />
            <Field label="Max Hours/Week" value={`${assignment.maxHoursPerWeek} hrs`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalBilled)}</p>
              <p className="text-xs text-blue-600">Total Billable</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold">{totalHours}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold">{formatCurrency(assignment.billRate)}</p>
                <p className="text-xs text-muted-foreground">Bill Rate/hr</p>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm font-bold">{formatCurrency(assignment.payRate)}</p>
              <p className="text-xs text-muted-foreground">Pay Rate/hr</p>
            </div>
          </CardContent>
        </Card>

        {/* Timesheets */}
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
                    <p className="text-xs text-muted-foreground">
                      {ts.weekStartDate} – {ts.weekEndDate}
                    </p>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assignment — {assignment.id}</DialogTitle>
          </DialogHeader>
          <AssignmentForm
            initial={assignment}
            isEdit
            onSubmit={data => {
              updateAssignment(assignment.id, data);
              toast.success('Assignment updated');
              setEditOpen(false);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Assignment?"
        description="This will permanently remove this assignment."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteAssignment(assignment.id);
          toast.success('Assignment deleted');
          navigate('/portal/assignments');
        }}
      />
    </div>
  );
}
