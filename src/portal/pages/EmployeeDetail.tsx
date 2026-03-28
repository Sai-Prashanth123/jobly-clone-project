import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { useEmployee, useUpdateEmployee, useDeleteEmployee, useEmployees } from '../hooks/useEmployees';
import { useAssignments } from '../hooks/useAssignments';
import { useTimesheets } from '../hooks/useTimesheets';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employee, isLoading } = useEmployee(id);
  const { data: assignmentsData } = useAssignments({ employeeId: id, limit: 100 });
  const { data: timesheetsData } = useTimesheets({ employeeId: id, limit: 100 });
  const { data: allEmployeesData } = useEmployees({ limit: 500 });
  const updateEmployee = useUpdateEmployee(id!);
  const deleteEmployee = useDeleteEmployee();

  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approvingOnboard, setApprovingOnboard] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Employee not found.</p>
        <Button variant="link" onClick={() => navigate('/portal/employees')}>← Back to Employees</Button>
      </div>
    );
  }

  const empAssignments = assignmentsData?.data ?? [];
  const empTimesheets = timesheetsData?.data ?? [];
  const totalHours = empTimesheets.reduce((s, t) => s + t.totalHours, 0);
  const allEmployees = allEmployeesData?.data ?? [];
  const reportingManager = allEmployees.find(e => e.id === employee?.reportingManagerId);

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/employees')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{employee.firstName} {employee.lastName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{employee.displayId ?? employee.id.slice(0, 8)}</span>
              <StatusBadge status={employee.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {employee.status === 'onboarding' && (user?.role === 'admin' || user?.role === 'hr') && (
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={approvingOnboard}
              onClick={async () => {
                setApprovingOnboard(true);
                try {
                  await updateEmployee.mutateAsync({ status: 'active' } as any);
                  toast.success('Employee onboarding approved — now Active');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to approve onboarding');
                } finally {
                  setApprovingOnboard(false);
                }
              }}
            >
              {approvingOnboard ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓ Approve Onboarding'}
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'hr') && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}
                className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Date of Birth" value={formatDate(employee.dob)} />
            <Field label="Address" value={`${employee.address.city}, ${employee.address.state}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Work Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-700">{totalHours}</p>
              <p className="text-xs text-blue-600">Total Hours Logged</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

        <Card>
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Department" value={employee.department} />
            <Field label="Job Title" value={employee.jobTitle} />
            <Field label="Employment Type" value={employee.employmentType.toUpperCase()} />
            <Field label="Start Date" value={formatDate(employee.startDate)} />
            <Field label="Work Location" value={employee.workLocation} />
            <Field label="Reporting Manager" value={reportingManager ? `${reportingManager.firstName} ${reportingManager.lastName}` : undefined} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Payroll</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Pay Rate" value={formatCurrency(employee.payRate)} />
            <Field label="Pay Type" value={employee.payType} />
            <Field label="Pay Frequency" value={employee.payFrequency} />
            <Field label="Payment Type" value={employee.paymentType?.toUpperCase()} />
            <Field label="Tax Form" value={employee.taxFormType?.toUpperCase()} />
            {employee.bankName && <Field label="Bank Name" value={employee.bankName} />}
            {employee.bankRoutingNumber && <Field label="Routing Number" value={`****${employee.bankRoutingNumber.slice(-4)}`} />}
            {employee.bankAccountNumber && <Field label="Account Number" value={`****${employee.bankAccountNumber.slice(-4)}`} />}
          </CardContent>
        </Card>

        {employee.visaType && (
          <Card>
            <CardHeader><CardTitle className="text-base">Immigration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="Visa Type" value={employee.visaType?.toUpperCase()} />
              <Field label="Visa Expiry" value={formatDate(employee.visaExpiry)} />
              <Field label="I-9 Status" value={employee.i9Status} />
            </CardContent>
          </Card>
        )}
      </div>

      {employee.documents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {employee.documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.type} • {formatDate(doc.uploadedAt)}</p>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">Download</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {empAssignments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {empAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.projectName}</p>
                    <p className="text-xs text-muted-foreground">{a.displayId ?? a.id.slice(0,8)} • {a.role} • Since {formatDate(a.startDate)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee — {employee.displayId ?? employee.id.slice(0,8)}</DialogTitle>
            <DialogDescription className="sr-only">Update the employee's information.</DialogDescription>
          </DialogHeader>
          <EmployeeForm
            initial={employee}
            isEdit
            onSubmit={async (data, _pendingFiles) => {
              try {
                await updateEmployee.mutateAsync(data as any);
                toast.success('Employee updated successfully');
                setEditOpen(false);
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to update employee');
              }
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${employee.firstName} ${employee.lastName}?`}
        description="This will permanently remove this employee and cannot be undone."
        confirmLabel="Delete Employee"
        onConfirm={async () => {
          try {
            await deleteEmployee.mutateAsync(employee.id);
            toast.success('Employee deleted');
            navigate('/portal/employees');
          } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to delete employee');
          }
        }}
      />
    </div>
  );
}
