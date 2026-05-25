import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Loader2, KeyRound } from 'lucide-react';
import { ChangePasswordDialog } from '../components/auth/ChangePasswordDialog';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { useEmployee } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { expiryStatus } from '../lib/expiry';
import { formatDate, formatCurrency } from '../lib/utils';

// Identity-doc type codes → the labels shown on the Add Employee form.
const ID_DOC_LABELS: Record<string, string> = {
  ssn: 'Social Security Number',
  driver_license: "Driver's License",
  state_id: 'State-Issued ID',
  passport: 'US Passport',
  green_card: 'Permanent Resident Card',
  ead: 'Employment Authorization Document',
};

export default function MyProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: employee, isLoading } = useEmployee(user?.employeeId);
  const [changePwOpen, setChangePwOpen] = useState(false);

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
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-words [overflow-wrap:anywhere]">{value || '—'}</p>
    </div>
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <EmployeeAvatar
            photoUrl={employee.profilePhotoUrl}
            name={`${employee.firstName} ${employee.lastName}`}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">
              {employee.firstName}{employee.middleName ? ` ${employee.middleName}` : ''} {employee.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono text-blue-600">{employee.displayId ?? employee.id.slice(0, 8)}</span>
              <StatusBadge status={employee.status} />
              {employee.jobTitle && <span className="text-xs text-muted-foreground">· {employee.jobTitle}</span>}
            </div>
          </div>
        </div>
        <Button onClick={() => navigate('/portal/profile/edit')} className="gap-2 flex-shrink-0">
          <Edit className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      {employee.status === 'onboarding' && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Your onboarding is in progress. Please complete your profile — HR will activate your account once reviewed.
        </div>
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
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Department" value={employee.department} />
            <Field label="Job Title" value={employee.jobTitle} />
            <Field label="Employment Type" value={employee.employmentType?.toUpperCase()} />
            <Field label="Start Date" value={formatDate(employee.startDate)} />
            <Field label="Work Location" value={employee.workLocation} />
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
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Authorization Expiry</p>
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
                <span className="ml-2 text-xs font-normal text-muted-foreground">· {employee.totalExperienceYears} years total</span>
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
                    {[formatDate(row.fromDate), formatDate(row.toDate), row.lastAnnualSalary != null && formatCurrency(row.lastAnnualSalary)]
                      .filter(Boolean).join(' → ')}
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
          <CardHeader><CardTitle className="text-base">My Documents</CardTitle></CardHeader>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-900">Password</p>
            <p className="text-xs text-muted-foreground">Change the password you use to sign in to Jobly.</p>
          </div>
          <Button variant="outline" onClick={() => setChangePwOpen(true)} className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Change password
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  );
}
