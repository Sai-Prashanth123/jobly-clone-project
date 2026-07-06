import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, ArrowLeft, Loader2, Mail, CheckCircle2, Clock, MessageSquareWarning, CalendarClock, UserX, UserCheck, CheckSquare2, Square, ListChecks, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { DocumentPreviewDialog } from '../components/shared/DocumentPreviewDialog';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { UsDateInput } from '../components/shared/UsDateInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useEmployee, useUpdateEmployee, useDeleteEmployee, useEmployees, useResendEmployeeCredentials,
  useRequestOnboardingChanges, usePlaceOnLeave, useReturnFromLeave, useTerminateEmployee, useRehireEmployee,
} from '../hooks/useEmployees';
import { useAssignments } from '../hooks/useAssignments';
import { useTimesheets } from '../hooks/useTimesheets';
import { useAuth } from '../hooks/useAuth';
import { useEmployeeOnboardingTasks, useToggleOnboardingTask } from '../hooks/useOnboardingChecklist';
import { OnboardingChecklist } from '../components/employees/OnboardingProgress';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { expiryStatus } from '../lib/expiry';
import { formatDate, formatCurrency, maskSsn } from '../lib/utils';
import { EntityAuditTrail } from '../components/shared/EntityAuditTrail';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isReviewer = user?.role === 'admin' || user?.role === 'hr';
  // Poll while a reviewer is looking at the page so a parallel re-submission by
  // the employee surfaces within a few seconds (the 409 guards are the safety
  // net; this is the proactive half). 0/false disables for everyone else.
  const { data: employee, isLoading, isError, refetch } = useEmployee(id, { refetchInterval: isReviewer ? 30000 : false });
  const { data: assignmentsData } = useAssignments({ employeeId: id, limit: 100 });
  const { data: timesheetsData } = useTimesheets({ employeeId: id, limit: 100 });
  const { data: allEmployeesData } = useEmployees({ limit: 500 });
  const { data: checklistTasks = [] } = useEmployeeOnboardingTasks(id);
  const toggleTask = useToggleOnboardingTask();
  const updateEmployee = useUpdateEmployee(id!);
  const deleteEmployee = useDeleteEmployee();
  const resendCreds = useResendEmployeeCredentials();
  const requestChanges = useRequestOnboardingChanges(id!);
  const placeOnLeave = usePlaceOnLeave(id!);
  const returnFromLeave = useReturnFromLeave(id!);
  const terminateEmployee = useTerminateEmployee(id!);
  const rehireEmployee = useRehireEmployee(id!);

  // UTC "today" for date-input defaults/minimums (matches the backend's todayUTC).
  const todayStr = new Date().toISOString().slice(0, 10);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesMessage, setChangesMessage] = useState('');
  // Part B — place-on-leave dialog.
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveStart, setLeaveStart] = useState(todayStr);
  const [leaveReturn, setLeaveReturn] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  // Part C — terminate dialog.
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateDate, setTerminateDate] = useState(todayStr);
  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null);
  // SSN visibility toggle (HR/Admin view — masked by default, eye button reveals full)
  const [ssnVisible, setSsnVisible] = useState(false);

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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load this employee.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!employee) {
    navigate('/portal/employees', { replace: true });
    return null;
  }

  const empAssignments = assignmentsData?.data ?? [];
  const empTimesheets = timesheetsData?.data ?? [];
  const totalHours = empTimesheets.reduce((s, t) => s + t.totalHours, 0);
  const allEmployees = allEmployeesData?.data ?? [];
  const reportingManager = allEmployees.find(e => e.id === employee?.reportingManagerId);
  const canManage = user?.role === 'admin' || user?.role === 'hr';

  // 'inactive' is overloaded: it backs three distinct states distinguished by
  // the leave/termination columns. Disambiguate so the action bar + badges show
  // the right control (Return vs Re-hire vs plain Activate).
  const isOnLeave = employee.status === 'inactive' && !!employee.leaveReturnDate && !employee.terminatedAt;
  const isTerminated = employee.status === 'inactive' && !!employee.terminatedAt;
  const isPlainInactive = employee.status === 'inactive' && !employee.leaveReturnDate && !employee.terminatedAt;

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
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
              {isOnLeave && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-100 border border-sky-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                  title={employee.leaveReason ? `Reason: ${employee.leaveReason}` : undefined}>
                  <CalendarClock className="h-3 w-3 flex-shrink-0" /> On leave · returns {formatDate(employee.leaveReturnDate)}
                </span>
              )}
              {isTerminated && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                  title={employee.terminationReason ? `Reason: ${employee.terminationReason}` : undefined}>
                  <UserX className="h-3 w-3 flex-shrink-0" /> Terminated · {formatDate(employee.terminatedAt)}
                </span>
              )}
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end sm:flex-shrink-0 gap-2 [&>*]:w-full sm:[&>*]:w-auto">
          {(employee.status === 'onboarding' || isPlainInactive) && canManage && (() => {
            const onboardingComplete = isPlainInactive || (employee.onboarding?.complete === true);
            const pct = employee.onboarding?.percent ?? 0;
            return onboardingComplete ? (
              <Button
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                loading={updateEmployee.isPending}
                loadingText={isPlainInactive ? 'Activating…' : 'Approving…'}
                onClick={async () => {
                  try {
                    await updateEmployee.mutateAsync({
                      status: 'active',
                      expectedOnboardingCompletedAt: employee.onboardingCompletedAt ?? null,
                    } as any);
                    toast.success(
                      isPlainInactive
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
                {isPlainInactive ? 'Activate Employee' : 'Approve Onboarding'}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2"
                variant="outline"
                disabled
                title={`Profile is only ${pct}% complete — employee must finish onboarding before approval`}
              >
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
                Approve ({pct}% complete)
              </Button>
            );
          })()}
          {/* Part B — return an on-leave employee early (manual counterpart to
              the scheduler's auto-reactivation on the return date). */}
          {isOnLeave && canManage && (
            <Button
              size="sm"
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              loading={returnFromLeave.isPending}
              loadingText="Returning…"
              onClick={async () => {
                try {
                  await returnFromLeave.mutateAsync();
                  toast.success(`${employee.firstName} is back from leave — now Active.`);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to return employee from leave');
                }
              }}
            >
              <UserCheck className="h-4 w-4" />
              Return from leave
            </Button>
          )}
          {/* Part C — re-hire a terminated employee: restores access + emails a
              fresh temp password. */}
          {isTerminated && canManage && (
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              loading={rehireEmployee.isPending}
              loadingText="Re-hiring…"
              onClick={async () => {
                try {
                  const r = await rehireEmployee.mutateAsync();
                  if (r.welcomeEmailSent) {
                    toast.success(`${employee.firstName} re-hired — fresh credentials emailed to ${r.loginEmail ?? employee.email}.`);
                  } else if (r.tempPassword) {
                    toast.warning(
                      `${employee.firstName} re-hired. ${r.warning ?? 'Email could not be delivered.'} Login: ${r.loginEmail} · Temp password: ${r.tempPassword}`,
                      { duration: 30000 },
                    );
                  } else {
                    toast.success(`${employee.firstName} re-hired — access restored.`);
                  }
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Failed to re-hire employee');
                }
              }}
            >
              <UserCheck className="h-4 w-4" />
              Re-hire (restore access)
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
                      toast.success(`Welcome email re-sent to ${[employee.email, employee.workEmail].filter(Boolean).join(' and ') || employee.email}. If not received, check spam/junk folder.`, { duration: 10000 });
                    } else if (r.tempPassword) {
                      toast.warning(
                        `${r.warning ?? 'Email could not be delivered.'} Login: ${r.loginEmail} · Temp password: ${r.tempPassword}`,
                        { duration: 30000 },
                      );
                    } else {
                      toast.error(r.warning ?? 'Resend failed.');
                    }
                  } catch {
                    /* failed-request toast raised centrally (queryClient.ts) */
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
              {/* Part B — place an active employee on extended leave. */}
              {employee.status === 'active' && (
                <Button variant="outline" size="sm"
                  onClick={() => { setLeaveStart(todayStr); setLeaveReturn(''); setLeaveReason(''); setLeaveOpen(true); }}
                  className="gap-2 text-sky-700 hover:bg-sky-50 border-sky-200">
                  <CalendarClock className="h-4 w-4" />
                  Place on leave
                </Button>
              )}
              {/* Part C — terminate (disable login, keep record). Shown for any
                  non-terminated employee. */}
              {!isTerminated && (
                <Button variant="outline" size="sm"
                  onClick={() => { setTerminateReason(''); setTerminateDate(todayStr); setTerminateOpen(true); }}
                  className="gap-2 text-red-700 hover:bg-red-50 border-red-200">
                  <UserX className="h-4 w-4" />
                  Terminate
                </Button>
              )}
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
              {employee.ssn ? (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Social Security Number</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm font-mono text-gray-900">
                      {ssnVisible ? employee.ssn : maskSsn(employee.ssn)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-700" onClick={() => setSsnVisible(v => !v)} title={ssnVisible ? 'Hide SSN' : 'Show SSN'}>
                      {ssnVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <Field label="Social Security Number" value={undefined} />
              )}
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
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="text-xs text-muted-foreground">{doc.type} • {formatDate(doc.uploadedAt)}</p>
                      {doc.expiryDate && (() => {
                        const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
                        const cls = days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-500';
                        return <span className={`text-xs font-medium ${cls}`}>Expires {formatDate(doc.expiryDate)}{days >= 0 && days <= 90 ? ` (${days}d)` : ''}</span>;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewDoc({ id: doc.id, name: doc.name })}>
                      Preview
                    </Button>
                    <DocumentDownloadButton docId={doc.id} fallbackUrl={doc.url} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isReviewer && (() => {
        const uploadedDocTypes = new Set(employee.documents.map(d => d.type));
        const complianceItems = [
          { label: "Driver's License / State ID", satisfiedBy: ["Driver's License", "State-Issued ID"] },
          { label: 'Passport', satisfiedBy: ['Passport'] },
          { label: 'Visa / Work Authorization', satisfiedBy: ['Visa / Work Authorization'] },
          { label: 'I-94', satisfiedBy: ['I-94'] },
          { label: 'Offer Letter', satisfiedBy: ['Offer Letter'] },
          { label: 'Resume', satisfiedBy: ['Resume'] },
        ];
        const statuses = complianceItems.map(item => ({
          ...item,
          done: item.satisfiedBy.some(t => uploadedDocTypes.has(t)),
        }));
        const doneCount = statuses.filter(s => s.done).length;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare2 className="h-4 w-4 text-blue-500" />
                Required Documents
                <span className="text-xs font-normal text-muted-foreground">{doneCount}/{statuses.length} uploaded</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {statuses.map(s => (
                  <li key={s.label} className="flex items-center gap-2.5 text-sm">
                    {s.done
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      : <Square className="h-4 w-4 text-red-400 flex-shrink-0" />}
                    <span className={s.done ? 'text-gray-700' : 'text-red-600 font-medium'}>{s.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })()}

      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={open => { if (!open) setPreviewDoc(null); }}
        docId={previewDoc?.id ?? ''}
        fileName={previewDoc?.name ?? ''}
      />

      {/* Onboarding Checklist — HR/admin only */}
      {canManage && checklistTasks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-blue-500" />
                Onboarding Checklist
                <span className="text-xs font-normal text-muted-foreground">
                  {checklistTasks.filter(t => t.isCompleted).length}/{checklistTasks.length} completed
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {checklistTasks.map(task => (
                <div key={task.id} className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors cursor-pointer ${task.isCompleted ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                  onClick={async () => {
                    try {
                      await toggleTask.mutateAsync({ taskId: task.id, employeeId: id! });
                    } catch { /* centrally handled */ }
                  }}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {task.isCompleted
                      ? <CheckSquare2 className="h-4 w-4 text-emerald-600" />
                      : <Square className="h-4 w-4 text-gray-300" />
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                      {task.isRequired && <span className="ml-1 text-[10px] text-red-500">*</span>}
                    </p>
                    {task.description && !task.isCompleted && (
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    )}
                    {task.isCompleted && task.completedByName && (
                      <p className="text-xs text-emerald-600 mt-0.5">✓ {task.completedByName}</p>
                    )}
                  </div>
                  <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize flex-shrink-0">
                    {task.category}
                  </span>
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

      <EntityAuditTrail entityType="employee" entityId={employee?.id} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${employee.firstName} ${employee.lastName}?`}
        description={
          empAssignments.length > 0 || empTimesheets.length > 0
            ? `This employee has ${empAssignments.length} assignment(s) and ${empTimesheets.length} timesheet(s). Deleting will permanently remove this employee and all linked records.`
            : 'This will permanently remove this employee and cannot be undone.'
        }
        confirmLabel="Delete Employee"
        loading={deleteEmployee.isPending}
        onConfirm={async () => {
          try {
            await deleteEmployee.mutateAsync(employee.id);
            toast.success('Employee deleted');
            setDeleteOpen(false);
            navigate('/portal/employees');
          } catch {
            /* failed-request toast raised centrally (queryClient.ts) */
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

      {/* Part B — Place-on-extended-leave dialog. Sets status → inactive with a
          return window; the employee auto-reactivates on the return date. */}
      <Dialog open={leaveOpen} onOpenChange={(open) => !placeOnLeave.isPending && setLeaveOpen(open)}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Place {employee.firstName} {employee.lastName} on extended leave</DialogTitle>
            <DialogDescription>
              Their account becomes inactive (dropped from assignments &amp; active headcount) but their
              login is kept. They&rsquo;ll reactivate automatically on the return date, or you can bring
              them back early with &ldquo;Return from leave&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-start">Leave starts</Label>
              <UsDateInput id="leave-start" value={leaveStart}
                onChange={setLeaveStart} disabled={placeOnLeave.isPending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-return">Expected return</Label>
              <UsDateInput id="leave-return" value={leaveReturn} min={leaveStart || todayStr}
                onChange={setLeaveReturn} disabled={placeOnLeave.isPending} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="leave-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="leave-reason" value={leaveReason} rows={3} maxLength={500}
                placeholder="e.g. Medical leave, sabbatical, parental leave"
                onChange={(e) => setLeaveReason(e.target.value)} disabled={placeOnLeave.isPending} className="resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={placeOnLeave.isPending}>Cancel</Button>
            <Button
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              loading={placeOnLeave.isPending}
              loadingText="Placing…"
              disabled={!leaveStart || !leaveReturn || leaveReturn <= leaveStart}
              onClick={async () => {
                try {
                  await placeOnLeave.mutateAsync({ startDate: leaveStart, returnDate: leaveReturn, reason: leaveReason.trim() || undefined });
                  toast.success(`${employee.firstName} placed on leave — returns ${formatDate(leaveReturn)}.`);
                  setLeaveOpen(false);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Could not place the employee on leave.');
                }
              }}
            >
              <CalendarClock className="h-4 w-4" />
              Place on leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Part C — Terminate dialog. Disables the login immediately and ends
          employment, but KEEPS the record (use Delete to erase data). */}
      <Dialog open={terminateOpen} onOpenChange={(open) => !terminateEmployee.isPending && setTerminateOpen(open)}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Terminate {employee.firstName} {employee.lastName}?</DialogTitle>
            <DialogDescription>
              This <strong>disables their portal login immediately</strong> and ends employment, but keeps
              the record and history. Use <strong>Delete</strong> instead to permanently erase their data.
              Re-hire later to restore access.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="term-date">Effective date</Label>
              <UsDateInput id="term-date" value={terminateDate}
                onChange={setTerminateDate} disabled={terminateEmployee.isPending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="term-reason" value={terminateReason} rows={3} maxLength={500}
                placeholder="e.g. End of contract, resignation, performance"
                onChange={(e) => setTerminateReason(e.target.value)} disabled={terminateEmployee.isPending} className="resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)} disabled={terminateEmployee.isPending}>Cancel</Button>
            <Button
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              loading={terminateEmployee.isPending}
              loadingText="Terminating…"
              disabled={!terminateDate}
              onClick={async () => {
                try {
                  await terminateEmployee.mutateAsync({ reason: terminateReason.trim() || undefined, effectiveDate: terminateDate });
                  toast.success(`${employee.firstName} terminated — their login is now disabled.`);
                  setTerminateOpen(false);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error ?? 'Could not terminate the employee.');
                }
              }}
            >
              <UserX className="h-4 w-4" />
              Terminate employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
