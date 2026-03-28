import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { useEmployee, useUpdateEmployee } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatCurrency } from '../lib/utils';

export default function MyProfile() {
  const { user } = useAuth();
  const { data: employee, isLoading } = useEmployee(user?.employeeId);
  const updateEmployee = useUpdateEmployee(user?.employeeId ?? '');
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Profile not found. Please contact HR.</p>
      </div>
    );
  }

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{employee.firstName} {employee.lastName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-blue-600">{employee.displayId ?? employee.id.slice(0, 8)}</span>
            <StatusBadge status={employee.status} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2 flex-shrink-0">
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      {employee.status === 'onboarding' && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Your onboarding is in progress. Please complete your profile — HR will activate your account once reviewed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Date of Birth" value={formatDate(employee.dob)} />
            <Field label="Address" value={[employee.address.street, employee.address.city, employee.address.state, employee.address.zip].filter(Boolean).join(', ')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job Title" value={employee.jobTitle} />
            <Field label="Department" value={employee.department} />
            <Field label="Employment Type" value={employee.employmentType?.toUpperCase()} />
            <Field label="Start Date" value={formatDate(employee.startDate)} />
            <Field label="Work Location" value={employee.workLocation} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Payroll</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Visa Type" value={employee.visaType?.toUpperCase()} />
              <Field label="Authorization Expiry" value={formatDate(employee.visaExpiry)} />
              <Field label="I-9 Status" value={employee.i9Status} />
            </CardContent>
          </Card>
        )}
      </div>

      {employee.documents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Documents</CardTitle></CardHeader>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit My Profile</DialogTitle>
            <DialogDescription className="sr-only">Update your personal and payroll information.</DialogDescription>
          </DialogHeader>
          <EmployeeForm
            initial={employee}
            isEdit
            onSubmit={async (data, _pendingFiles) => {
              try {
                await updateEmployee.mutateAsync(data as any);
                toast.success('Profile updated successfully');
                setEditOpen(false);
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? 'Failed to update profile');
              }
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
