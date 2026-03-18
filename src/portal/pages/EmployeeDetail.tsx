import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { usePortalData } from '../hooks/usePortalData';
import { formatDate, formatCurrency } from '../lib/utils';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, updateEmployee, deleteEmployee, assignments, timesheets } = usePortalData();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const employee = employees.find(e => e.id === id);
  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Employee not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/employees')}>← Back to Employees</Button>
      </div>
    );
  }

  const empAssignments = assignments.filter(a => a.employeeId === id);
  const empTimesheets = timesheets.filter(t => t.employeeId === id);
  const totalHours = empTimesheets.reduce((s, t) => s + t.totalHours, 0);

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/employees')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{employee.firstName} {employee.lastName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{employee.id}</span>
              <StatusBadge status={employee.status} />
            </div>
          </div>
        </div>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Date of Birth" value={formatDate(employee.dob)} />
            <Field label="Address" value={`${employee.address.city}, ${employee.address.state}`} />
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader><CardTitle className="text-base">Work Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-700">{totalHours}</p>
              <p className="text-xs text-blue-600">Total Hours Logged</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold">{empAssignments.length}</p>
                <p className="text-xs text-muted-foreground">Assignments</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold">{empTimesheets.length}</p>
                <p className="text-xs text-muted-foreground">Timesheets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment */}
        <Card>
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Department" value={employee.department} />
            <Field label="Job Title" value={employee.jobTitle} />
            <Field label="Employment Type" value={employee.employmentType.toUpperCase()} />
            <Field label="Start Date" value={formatDate(employee.startDate)} />
          </CardContent>
        </Card>

        {/* Payroll */}
        <Card>
          <CardHeader><CardTitle className="text-base">Payroll</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Pay Rate" value={formatCurrency(employee.payRate)} />
            <Field label="Pay Type" value={employee.payType} />
            <Field label="Pay Frequency" value={employee.payFrequency} />
          </CardContent>
        </Card>

        {/* Immigration */}
        {employee.visaType && (
          <Card>
            <CardHeader><CardTitle className="text-base">Immigration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Visa Type" value={employee.visaType?.toUpperCase()} />
              <Field label="Visa Expiry" value={formatDate(employee.visaExpiry)} />
              <Field label="I-9 Status" value={employee.i9Status} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assignments */}
      {empAssignments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {empAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.projectName}</p>
                    <p className="text-xs text-muted-foreground">{a.clientId} • {a.role} • Since {formatDate(a.startDate)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee — {employee.id}</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            initial={employee}
            isEdit
            onSubmit={data => {
              updateEmployee(employee.id, data);
              toast.success('Employee updated successfully');
              setEditOpen(false);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${employee.firstName} ${employee.lastName}?`}
        description="This will permanently remove this employee and cannot be undone."
        confirmLabel="Delete Employee"
        onConfirm={() => {
          deleteEmployee(employee.id);
          toast.success('Employee deleted');
          navigate('/portal/employees');
        }}
      />
    </div>
  );
}
