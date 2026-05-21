import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useEmployee, useUpdateEmployee, useDeleteEmployee, useEmployees, useResendEmployeeCredentials } from '../hooks/useEmployees';
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
  const resendCreds = useResendEmployeeCredentials();

  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    // min-w-0 lets the grid cell shrink below its content; break-words +
    // overflow-wrap:anywhere force long unbroken strings (e.g. emails) to wrap
    // instead of bleeding into the neighbouring column.
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-words [overflow-wrap:anywhere]">{value || '—'}</p>
    </div>
  );

  // Map identity-doc type codes to the labels HR sees on the Add Employee form.
  const ID_DOC_LABELS: Record<string, string> = {
    ssn: 'Social Security Number',
    driver_license: "Driver's License",
    state_id: 'State-Issued ID',
    passport: 'US Passport',
    green_card: 'Permanent Resident Card',
    ead: 'Employment Authorization Document',
  };
  const hasPermAddr = !!employee.permanentAddress && (
    employee.permanentAddress.street || employee.permanentAddress.city || employee.permanentAddress.state
  );
  const ec = employee.emergencyContact;
  const hasEC = !!ec && (ec.name || ec.phone);
  const identityDocs = (employee.identityDocuments ?? []).filter(d => (d.number ?? '').trim() !== '');
  const educationList = employee.education ?? [];
  const workList = employee.workHistory ?? [];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/employees')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          {/* Profile photo, or a default human silhouette when none is set */}
          <EmployeeAvatar
            photoUrl={employee.profilePhotoUrl}
            name={`${employee.firstName} ${employee.lastName}`}
            size="md"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">
              {employee.firstName}{employee.middleName ? ` ${employee.middleName}` : ''} {employee.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-blue-600">{employee.displayId ?? employee.id.slice(0, 8)}</span>
              <StatusBadge status={employee.status} />
              {employee.jobTitle && <span className="text-xs text-muted-foreground">· {employee.jobTitle}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 [&>*]:w-full sm:[&>*]:w-auto">
          {(employee.status === 'onboarding' || employee.status === 'inactive') && (user?.role === 'admin' || user?.role === 'hr') && (
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              loading={updateEmployee.isPending}
              loadingText={employee.status === 'inactive' ? 'Activating…' : 'Approving…'}
              onClick={async () => {
                try {
                  await updateEmployee.mutateAsync({ status: 'active' } as any);
                  toast.success(
                    employee.status === 'inactive'
                      ? `${employee.firstName} is now Active`
                      : 'Employee onboarding approved — now Active',
                  );
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to activate employee');
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {employee.status === 'inactive' ? 'Activate Employee' : 'Approve Onboarding'}
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'hr') && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                loading={resendCreds.isPending}
                loadingText="Sending…"
                onClick={async () => {
                  try {
                    const r = await resendCreds.mutateAsync(employee.id);
                    if (r.welcomeEmailSent) {
                      toast.success(`Welcome email re-sent to ${employee.email}.`);
                    } else if (r.tempPassword) {
                      toast.warning(
                        `${r.warning ?? 'Email could not be delivered.'} Login: ${r.loginEmail} · Temp password: ${r.tempPassword}`,
                        { duration: 30000 },
                      );
                    } else {
                      toast.error(r.warning ?? 'Resend failed.');
                    }
                  } catch (err: any) {
                    toast.error(err?.response?.data?.error ?? 'Failed to resend credentials');
                  }
                }}
              >
                <Mail className="h-4 w-4" />
                Resend Welcome Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/portal/employees/${employee.id}/edit`)} className="gap-2">
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Field label="Personal Email" value={employee.email} />
            <Field label="Work Email" value={employee.workEmail} />
            <Field label="Mobile Phone" value={employee.phone} />
            <Field label="Alternate Phone" value={employee.altPhone} />
            <Field label="Date of Birth" value={formatDate(employee.dob)} />
            <Field label="Gender" value={employee.gender} />
            <Field label="Marital Status" value={employee.maritalStatus} />
            <Field label="Blood Group" value={employee.bloodGroup} />
            <Field label="Nationality" value={employee.nationality} />
            <Field label="Preferred Language" value={employee.preferredLanguage} />
            <Field label="Languages Known" value={employee.languagesKnown} />
            <Field label="LinkedIn" value={employee.linkedinUrl} />
            <Field label="Skype / Teams" value={employee.skypeId} />
            <div className="sm:col-span-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Present Address</p>
              <p className="text-sm text-gray-900 mt-0.5">
                {[employee.address.street, employee.address.city, employee.address.state, employee.address.zip, employee.address.country]
                  .filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            {hasPermAddr && (
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Permanent Address</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {[employee.permanentAddress!.street, employee.permanentAddress!.city, employee.permanentAddress!.state, employee.permanentAddress!.zip, employee.permanentAddress!.country]
                    .filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            )}
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
            <Field label="Payment Type" value={employee.paymentType?.toUpperCase()} />
            <Field label="Tax Form" value={employee.taxFormType?.toUpperCase()} />
            {employee.bankName && <Field label="Bank Name" value={employee.bankName} />}
            {employee.bankRoutingNumber && <Field label="Routing Number" value={`****${employee.bankRoutingNumber.slice(-4)}`} />}
            {employee.bankAccountNumber && <Field label="Account Number" value={`****${employee.bankAccountNumber.slice(-4)}`} />}
          </CardContent>
        </Card>

        {(employee.visaType || employee.ssn) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Immigration & I-9</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="Visa Type" value={employee.visaType?.toUpperCase()} />
              <Field label="Visa Expiry" value={formatDate(employee.visaExpiry)} />
              <Field label="I-9 Status" value={employee.i9Status} />
              <Field label="SSN (last 4)" value={employee.ssn ? `•••• ${employee.ssn}` : undefined} />
            </CardContent>
          </Card>
        )}

        {hasEC && (
          <Card>
            <CardHeader><CardTitle className="text-base">Emergency Contact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="Name" value={ec!.name} />
              <Field label="Relationship" value={ec!.relationship} />
              <Field label="Phone" value={ec!.phone} />
              <Field label="Alternate Phone" value={ec!.altPhone} />
              {ec!.address && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Address</p>
                  <p className="text-sm text-gray-900 mt-0.5">{ec!.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {identityDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Identity & Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {identityDocs.map((d, i) => (
                <div key={`${d.type}-${i}`} className="p-3 rounded-md bg-gray-50/60 border border-gray-100">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                    {ID_DOC_LABELS[d.type] ?? d.type}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5 font-mono">{d.number || '—'}</p>
                  {(d.state || d.expiry) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {d.state && <span>State: {d.state}</span>}
                      {d.state && d.expiry && <span> · </span>}
                      {d.expiry && <span>Expires {formatDate(d.expiry)}</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {educationList.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Education ({educationList.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {educationList.map((row, i) => (
                <div key={i} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.level || '—'}{row.specialization ? ` · ${row.specialization}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {[row.institution, row.passYear, row.gradeOrGPA && `GPA ${row.gradeOrGPA}`, row.mode].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {workList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Work Experience ({workList.length})
              {employee.totalExperienceYears != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {employee.totalExperienceYears} years total
                </span>
              )}
              {employee.experienceLevel && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">· {employee.experienceLevel}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workList.map((row, i) => (
                <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium">{row.jobTitle || '—'} at {row.company || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      formatDate(row.fromDate),
                      formatDate(row.toDate),
                      row.lastAnnualSalary != null && formatCurrency(row.lastAnnualSalary),
                    ].filter(Boolean).join(' → ')}
                  </p>
                  {row.reasonForLeaving && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">Left because: {row.reasonForLeaving}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${employee.firstName} ${employee.lastName}?`}
        description="This will permanently remove this employee and cannot be undone."
        confirmLabel="Delete Employee"
        loading={deleteEmployee.isPending}
        onConfirm={async () => {
          try {
            await deleteEmployee.mutateAsync(employee.id);
            toast.success('Employee deleted');
            setDeleteOpen(false);
            navigate('/portal/employees');
          } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to delete employee');
          }
        }}
      />
    </div>
  );
}
