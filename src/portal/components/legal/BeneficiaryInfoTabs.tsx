import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DetailField as Field } from '../shared/DetailField';
import { ExpiryBadge } from '../shared/ExpiryBadge';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

// Personal/Employment/Additional Information split, sourced from whatever
// fields cases.service.ts's EMPLOYEE_EMBED returns for this case's employee
// (kept in sync with the `legal` role's LEGAL_ALLOWED_EMPLOYEE_FIELDS
// allowlist on the backend — no SSN/bank/pay data ever reaches this view).
export function BeneficiaryInfoTabs({ beneficiary }: { beneficiary?: Partial<Employee> }) {
  if (!beneficiary) {
    return <p className="text-sm text-gray-400 py-6 text-center">No beneficiary information available.</p>;
  }
  const b = beneficiary;

  return (
    <Tabs defaultValue="personal">
      <TabsList>
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="employment">Employment</TabsTrigger>
        <TabsTrigger value="additional">Additional Information</TabsTrigger>
      </TabsList>

      <TabsContent value="personal" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Field label="Full Name" value={[b.firstName, b.lastName].filter(Boolean).join(' ') || undefined} />
        <Field label="Date of Birth" value={b.dob ? formatDate(b.dob) : undefined} />
        <Field label="Gender" value={b.gender} />
        <Field label="Marital Status" value={b.maritalStatus} />
        <Field label="Nationality" value={b.nationality} />
        <Field label="Preferred Language" value={b.preferredLanguage} />
        <Field label="Languages Known" value={b.languagesKnown} />
      </TabsContent>

      <TabsContent value="employment" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Field label="Department" value={b.department} />
        <Field label="Job Title" value={b.jobTitle} />
        <Field label="Employment Type" value={b.employmentType} />
        <Field label="Start Date" value={b.startDate ? formatDate(b.startDate) : undefined} />
        <Field label="Work Location" value={b.workLocation} />
        <Field label="I-9 Status" value={b.i9Status} />
        <Field label="E-Verify Status" value={b.eVerifyStatus} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Visa Expiry</p>
          <p className="text-sm text-gray-900 mt-0.5 flex flex-wrap items-center gap-2">
            <span>{b.visaExpiry ? formatDate(b.visaExpiry) : '—'}</span>
            <ExpiryBadge date={b.visaExpiry} />
          </p>
        </div>
      </TabsContent>

      <TabsContent value="additional" className="space-y-6 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone" value={b.phone} />
          <Field label="Alt Phone" value={b.altPhone} />
          <Field
            label="Present Address"
            value={b.address ? [b.address.street, b.address.city, b.address.state, b.address.zip].filter(Boolean).join(', ') || undefined : undefined}
          />
          <Field
            label="Permanent Address"
            value={b.permanentAddress ? [b.permanentAddress.street, b.permanentAddress.city, b.permanentAddress.state, b.permanentAddress.zip].filter(Boolean).join(', ') || undefined : undefined}
          />
        </div>

        {b.emergencyContact && (b.emergencyContact.name || b.emergencyContact.phone) && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Emergency Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" value={b.emergencyContact.name} />
              <Field label="Relationship" value={b.emergencyContact.relationship} />
              <Field label="Phone" value={b.emergencyContact.phone} />
              <Field
                label="Address"
                value={[b.emergencyContact.address, b.emergencyContact.city, b.emergencyContact.state, b.emergencyContact.zip].filter(Boolean).join(', ') || undefined}
              />
            </div>
          </div>
        )}

        {!!b.education?.length && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Education</p>
            <div className="space-y-2">
              {b.education.map((edu, i) => (
                <div key={i} className="text-sm text-gray-900 border border-gray-100 rounded-md px-3 py-2">
                  {[edu.level, edu.specialization, edu.institution, edu.passYear].filter(Boolean).join(' · ') || '—'}
                </div>
              ))}
            </div>
          </div>
        )}

        {!!b.workHistory?.length && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Work History</p>
            <div className="space-y-2">
              {b.workHistory.map((w, i) => (
                <div key={i} className="text-sm text-gray-900 border border-gray-100 rounded-md px-3 py-2">
                  {[w.jobTitle, w.company, [w.fromDate, w.toDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ') || '—'}
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
