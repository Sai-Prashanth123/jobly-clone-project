import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronDown, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DetailField as Field } from '../shared/DetailField';
import { StatusBadge } from '../shared/StatusBadge';
import { useAssignments } from '../../hooks/useAssignments';
import { useClient } from '../../hooks/useClients';
import { formatDate } from '../../lib/utils';
import type { Employee } from '../../types';

/**
 * Who this employee works for, and the paperwork that ties the two together.
 *
 * Previously you had to leave the employee, find the assignment, then find the
 * client, to answer "who are they placed with and is the contract on file".
 *
 * Only reachable by admin, HR and Project Manager — not because of anything
 * here, but because the whole employee record page is route-restricted to
 * those three (PortalApp.tsx). Employees cannot open this page at all, which
 * is what keeps client contracts and rates away from them. This component
 * deliberately adds no route of its own.
 *
 * Client fields are redacted server-side by role (redactClient strips tax id,
 * rates and notes for operations and finance), so a Project Manager sees the
 * engagement without the commercials.
 */

/** Documents held against the EMPLOYEE that exist because of a client placement. */
const CLIENT_LINKED_EMPLOYEE_DOCS = new Set([
  'LCA',
  'Copy of LCA',
  'Vendor Letter',
  'Project-Related Documents',
  'Contract / MSA (Petitioner & Vendor)',
  'Employer-Countersigned Offer / Contract Letter',
  'Employer Letter / Employment Verification Letter',
]);

interface DocLike { id: string; name: string; type?: string; uploadedAt?: string }

function DocList({
  docs, empty, onPreview,
}: {
  docs: DocLike[];
  empty: string;
  onPreview: (doc: { id: string; name: string }) => void;
}) {
  if (docs.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <div className="space-y-1">
      {docs.map(d => (
        <button
          key={d.id}
          type="button"
          onClick={() => onPreview({ id: d.id, name: d.name })}
          className="w-full flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
          title={`Preview ${d.name}`}
        >
          <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-gray-900 truncate">{d.name}</span>
            {d.type && <span className="block text-[11px] text-gray-500 truncate">{d.type}</span>}
          </span>
          {d.uploadedAt && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(d.uploadedAt)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ClientEngagementCard({
  employee,
  onPreview,
}: {
  employee: Employee;
  onPreview: (doc: { id: string; name: string }) => void;
}) {
  const { data: assignmentData, isLoading } = useAssignments({ employeeId: employee.id, limit: 100 });

  // Current placements first, then past — the question is almost always
  // "who are they on now", with history as context.
  const assignments = useMemo(() => {
    const rows = assignmentData?.data ?? [];
    const rank = (s?: string) => (s === 'active' ? 0 : s === 'pending' ? 1 : 2);
    return [...rows].sort((a, b) => rank(a.status) - rank(b.status)
      || (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  }, [assignmentData]);

  const clients = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments) if (a.clientId && !seen.has(a.clientId)) seen.set(a.clientId, a.clientName ?? 'Client');
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [assignments]);

  // Open by default: this card answers "who are they on", which is usually
  // why the record was opened. Collapsing is for when it is in the way.
  const [expanded, setExpanded] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const activeClientId = selectedClientId ?? clients[0]?.id;
  // One query, for the client in view — a hook cannot be called per client.
  const { data: client, isLoading: loadingClient } = useClient(activeClientId);

  const linkedEmployeeDocs = useMemo(
    () => (employee.documents ?? []).filter(d => d.type && CLIENT_LINKED_EMPLOYEE_DOCS.has(d.type)),
    [employee.documents],
  );

  // The collapse control belongs to the CARD, not to the happy path. It used
  // to live only in the branch that renders placements, so an employee with
  // no assignments — or one still loading — got a card with no toggle at all,
  // which reads as the button having never been added.
  const header = (subtitle?: string) => (
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <CardTitle className="text-base">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            aria-controls="client-placement-body"
            className="flex items-center gap-2 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <Building2 className="h-4 w-4 text-[#4069FF]" />
            Client/Project
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
            {!expanded && subtitle && (
              <span className="text-xs font-normal text-gray-400">{subtitle}</span>
            )}
          </button>
        </CardTitle>
        {client && expanded && (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
            <Link to={`/portal/clients/${client.id}`}>
              Client record <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card>
        {header()}
        {expanded && <CardContent><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></CardContent>}
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        {header('no placements')}
        {expanded && (
          <CardContent>
            <p className="text-sm text-gray-400">
              {employee.firstName} has no assignments, so there is no client to show.
              Create one under Assignments to link them to a client.
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  const assignmentsForClient = assignments.filter(a => a.clientId === activeClientId);

  return (
    <Card>
      {header(`${assignments.length} placement${assignments.length === 1 ? '' : 's'}`)}
      <CardHeader className="pt-0 pb-3">
        {/* Only when they have worked with more than one, and only while open. */}
        {expanded && clients.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {clients.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClientId(c.id)}
                className={`text-[11px] px-2 py-1 rounded-full border transition ${
                  c.id === activeClientId
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && (
      <CardContent id="client-placement-body" className="space-y-5">
        {loadingClient ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : client ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Client" value={client.companyName} />
            <Field label="Status" value={client.status} />
            <Field label="Contact" value={client.contactName} />
            <Field label="Contact Email" value={client.contactEmail} />
            <Field label="Billing Contact" value={client.billingContactName} />
            <Field label="Billing Email" value={client.billingContactEmail} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">Client details unavailable.</p>
        )}

        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1.5">
            Placement{assignmentsForClient.length === 1 ? '' : 's'} with this client
          </p>
          <div className="space-y-2">
            {assignmentsForClient.map(a => (
              <Link
                key={a.id}
                to={`/portal/assignments/${a.id}`}
                className="block rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.projectName || 'Untitled project'}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {[a.role, a.workLocation].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : 'ongoing'}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* The client's own paperwork — contracts and anything filed against
            the client record itself. */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1.5">
            Client documents
          </p>
          <DocList
            docs={(client?.documents ?? []) as DocLike[]}
            empty="Nothing filed against this client yet."
            onPreview={onPreview}
          />
        </div>

        {/* ...and the employee-side paperwork that exists only because of a
            placement: the LCA, the vendor letter, the countersigned contract. */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1.5">
            Placement documents for {employee.firstName}
          </p>
          <DocList
            docs={linkedEmployeeDocs as DocLike[]}
            empty="No LCA, vendor letter or contract on file for this employee."
            onPreview={onPreview}
          />
        </div>
      </CardContent>
      )}
    </Card>
  );
}
