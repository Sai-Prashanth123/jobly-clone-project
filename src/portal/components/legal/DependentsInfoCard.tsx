import { DetailField as Field } from '../shared/DetailField';
import { ExpiryBadge } from '../shared/ExpiryBadge';
import { DependentPassportButton } from './DependentPassportButton';
import { formatDate } from '../../lib/utils';
import type { Dependent } from '../../types';

// Both Dependents Info (spouse) and Children Info are UI-level filters over
// the same employees.dependents JSONB array — no schema split needed.
export function DependentsInfoCard({ employeeId, dependents, relationship }: {
  employeeId?: string;
  dependents?: Dependent[];
  relationship: 'spouse' | 'child';
}) {
  const filtered = (dependents ?? []).filter(d => d.relationship === relationship);

  if (!filtered.length) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        No {relationship === 'spouse' ? 'spouse' : 'children'} on file.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.map(dep => (
        <div key={dep.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={relationship === 'spouse' ? 'Name of Spouse' : 'Name of Child'} value={[dep.firstName, dep.lastName].filter(Boolean).join(' ') || undefined} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Passport Expiry</p>
              <p className="text-sm text-gray-900 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{dep.passportExpiry ? formatDate(dep.passportExpiry) : '—'}</span>
                <ExpiryBadge date={dep.passportExpiry} />
              </p>
            </div>
          </div>
          {employeeId && dep.passportStoragePath && (
            <DependentPassportButton employeeId={employeeId} dependentId={dep.id} />
          )}
        </div>
      ))}
    </div>
  );
}
