import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, ArrowLeft, Loader2, Mail, CheckCircle2, Clock, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useEmployee, useUpdateEmployee, useDeleteEmployee, useEmployees, useResendEmployeeCredentials, useRequestOnboardingChanges } from '../hooks/useEmployees';
import { useAssignments } from '../hooks/useAssignments';
import { useTimesheets } from '../hooks/useTimesheets';
import { useAuth } from '../hooks/useAuth';
import { OnboardingChecklist } from '../components/employees/OnboardingProgress';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { expiryStatus } from '../lib/expiry';
import { formatDate, formatCurrency } from '../lib/utils';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isReviewer = user?.role === 'admin' || user?.role === 'hr';
  // Poll while a reviewer is looking at the page so a parallel re-submission by
  // the employee surfaces within a few seconds (the 409 guards are the safety
  // net; this is the proactive half). 0/false disables for everyone else.
  const { data: employee, isLoading } = useEmployee(id, { refetchInterval: isReviewer ? 15000 : false });
  const { data: assignmentsData } = useAssignments({ employeeId: id, limit: 100 });
  const { data: timesheetsData } = useTimesheets({ employeeId: id, limit: 100 });
  const { data: allEmployeesData } = useEmployees({ limit: 500 });
  const updateEmployee = useUpdateEmployee(id!);
  const deleteEmployee = useDeleteEmployee();
  const resendCreds = useResendEmployeeCredentials();
  const requestChanges = useRequestOnboardingChanges(id!);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesMessage, setChangesMessage] = useState('');

  // Detect a re-submission while this reviewer has the page open: remember the
  // submission timestamp first seen, and flag when a poll brings a newer one.
  const firstSeenSubmittedAt = useRef<string | null | undefined>(undefined);
  const [resubmittedBanner, setResubmittedBanner] = useState(false);
  useEffect(() => {
    if (!employee) return;
    const ts = employee.onboardingCompletedAt ?? null;
    if (firstSeenSubmittedAt.current === undefined) {
      firstSeenSubmittedAt.current = ts;
      return;
    }
    if (ts && ts !== firstSeenSubmittedAt.current) {
      firstSeenSubmittedAt.current = ts;
      setResubmittedBanner(true);
    }
  }, [employee?.onboardingCompletedAt, employee]);

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
    passport: 'Passport',
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
    <div className="space-y-4 sm:space-y-6">
      {resubmittedBanner && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 portal-animate-in">
          <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <strong>{employee.firstName} re-submitted their onboarding just now.</strong> You're viewing the latest version — review it before approving or requesting changes.
          </p>
          <button type="button" onClick={() => setResubmittedBanner(false)} className="text-amber-700 hover:text-amber-900 text-xs font-medium flex-shrink-0">Dismiss</button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-3 min-w-0">
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5">
              <span className="text-xs font-mono text-blue-600 whitespace-nowrap">{employee.displayId ?? employee.id.slice(0, 8)}</span>
              <StatusBadge status={employee.status} />
              {employee.status === 'onboarding' && employee.onboardingCompletedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  <Clock className="h-3 w-3 flex-shrink-0" /> Submitted — ready for review
                </span>
              )}
              {employee.onboardingChangeRequestMessage && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                  title={`Sent ${employee.onboardingChangeRequestedAt ? formatDate(employee.onboardingChangeRequestedAt) : ''}: ${employee.onboardingChangeRequestMessage}`}
                >
                  <MessageSquareWarning className="h-3 w-3 flex-shrink-0" /> Changes requested — awaiting employee
                </span>
              )}
              {employee.jobTitle && <span className="text-xs text-muted-foreground whitespace-nowrap">· {employee.jobTitle}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:justify-end lg:flex-shrink-0 gap-2 [&>*]:w-full sm:[&>*]:w-auto">
          {(employee.status === 'onboarding' || employee.status === 'inactive') && (user?.role === 'admin' || user?.role === 'hr') && (
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              loading={updateEmployee.isPending}
              loadingText={employee.status === 'inactive' ? 'Activating…' : 'Approving…'}
              onClick={async () => {
                try {
                  await updateEmployee.mutateAsync({
                    status: 'active',
                    // Guard token: the submission this reviewer is approving.
                    expectedOnboardingCompletedAt: employee.onboardingCompletedAt ?? null,
                  } as any);
                  toast.success(
                    employee.status === 'inactive'
                      ? `${employee.firstName} is now Active`
                      : 'Employee onboarding approved — now Active',
                  );
                } catch (err: any) {
                  if (err?.response?.status === 409) {
                    toast.warning(err.response.data?.error ?? 'The employee changed their submission — showing the latest.', { duration: 10000 });
                    qc.invalidateQueries({ queryKey: ['employees', id] });
                  } else {
                    toast.error(err?.response?.data?.error ?? 'Failed to activate employee');
                  }
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {employee.status === 'inactive' ? 'Activate Employee' : 'Approve Onboarding'}
            </Button>
          )}
          {/* Request Changes — only shown when the employee has actually
              submitted (status onboarding + completed_at set). Lets HR ask the
              employee to fix something before approving. */}
          {employee.status === 'onboarding' && employee.onboardingCompletedAt && (user?.role === 'admin' || user?.role === 'hr') && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={() => { setChangesMessage(''); setChangesOpen(true); }}
            >
              <MessageSquareWarning className="h-4 w-4" />
              Request Changes
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

      {employee.onboarding && (employee.status === 'onboarding' || !employee.onboarding.complete) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Onboarding</CardTitle></CardHeader>
          <CardContent><OnboardingChecklist onboarding={employee.onboarding} /></CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
            <div className="sm:col-span-3 xl:col-span-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Present Address</p>
              <p className="text-sm text-gray-900 mt-0.5">
                {[employee.address.street, employee.address.city, employee.address.state, employee.address.zip, employee.address.country]
                  .filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            {hasPermAddr && (
              <div className="sm:col-span-3 xl:col-span-4">
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
            <Field label="Employment Type" value={employee.employmentType?.toUpperCase()} />
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
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Visa Expiry</p>
                <p className="text-sm text-gray-900 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{formatDate(employee.visaExpiry)}</span>
                  <ExpiryBadge date={employee.visaExpiry} />
                </p>
              </div>
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
                <div key={`${d.type}-${i}`} className={`p-3 rounded-md border ${expiryStatus(d.expiry) === 'expired' ? 'bg-red-50/60 border-red-200' : expiryStatus(d.expiry) === 'expiring' ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50/60 border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                      {ID_DOC_LABELS[d.type] ?? d.type}
                    </p>
                    <ExpiryBadge date={d.expiry} />
                  </div>
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
                  <DocumentDownloadButton docId={doc.id} fallbackUrl={doc.url} />
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

      {/* Request-Changes dialog — HR types a message that the employee will see
          on the OnboardingPending screen + receive via email. */}
      <Dialog open={changesOpen} onOpenChange={(open) => !requestChanges.isPending && setChangesOpen(open)}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Request changes to onboarding</DialogTitle>
            <DialogDescription>
              Send {employee.firstName} {employee.lastName} a note about what to fix. They&rsquo;ll get an
              email + in-app notification and the message will appear on their onboarding page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={changesMessage}
              onChange={(e) => setChangesMessage(e.target.value)}
              placeholder="e.g. Please re-upload your Passport — the previous file was cut off. Also fix your phone number — it&rsquo;s missing a digit."
              rows={6}
              maxLength={2000}
              disabled={requestChanges.isPending}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">
              {changesMessage.length} / 2000
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)} disabled={requestChanges.isPending}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const msg = changesMessage.trim();
                if (msg.length < 1) {
                  toast.error('Please enter a message.');
                  return;
                }
                try {
                  await requestChanges.mutateAsync({ message: msg, expectedSubmittedAt: employee.onboardingCompletedAt ?? null });
                  toast.success(`${employee.firstName} has been notified.`);
                  setChangesOpen(false);
                } catch (err: any) {
                  if (err?.response?.status === 409) {
                    // The employee re-submitted/reopened while HR was reviewing —
                    // don't write a stale change request; reload the latest.
                    toast.warning(err.response.data?.error ?? 'The employee updated their submission — showing the latest.', { duration: 10000 });
                    setChangesOpen(false);
                    qc.invalidateQueries({ queryKey: ['employees', id] });
                  } else {
                    toast.error(err?.response?.data?.error ?? 'Could not send the request. Please try again.');
                  }
                }
              }}
              loading={requestChanges.isPending}
              loadingText="Sending&hellip;"
              disabled={changesMessage.trim().length < 1}
              className="gap-2"
            >
              <MessageSquareWarning className="h-4 w-4" />
              Send to employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
