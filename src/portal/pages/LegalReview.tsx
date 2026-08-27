import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, Scale, FlagTriangleRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { useEmployees } from '../hooks/useEmployees';
import { formatDate } from '../lib/utils';
import type { Employee } from '../types';

const E_VERIFY_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  employment_authorized: 'Employment Authorized',
  tentative_nonconfirmation: 'Tentative Nonconfirmation',
  case_closed: 'Case Closed',
};

function flaggedCount(emp: Employee) {
  return emp.documents.filter(d => d.legalFlagged).length;
}

const VALID_FILTERS = ['all', 'visa', 'flagged'] as const;
type FilterValue = (typeof VALID_FILTERS)[number];

export function LegalReview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Legal's role-based redaction happens server-side (employees.service.ts
  // redactEmployee) — every field this page doesn't explicitly render below
  // (salary, bank details, personal contact, etc.) already comes back null.
  const { data, isLoading, isError, isFetching, refetch } = useEmployees({ limit: 500 });
  const employees = useMemo(() => data?.data ?? [], [data]);

  const withVisa = useMemo(() => employees.filter(e => e.visaType), [employees]);
  const flaggedTotal = useMemo(() => employees.reduce((sum, e) => sum + flaggedCount(e), 0), [employees]);

  // Filter state lives in the URL (?filter=visa|flagged) so clicking a stat
  // card actually navigates to a shareable/bookmarkable filtered view, not
  // just a local toggle that resets on refresh.
  const rawFilter = searchParams.get('filter');
  const filter: FilterValue = VALID_FILTERS.includes(rawFilter as FilterValue) ? (rawFilter as FilterValue) : 'all';
  const toggleFilter = (f: FilterValue) => {
    const next = filter === f ? 'all' : f;
    setSearchParams(next === 'all' ? {} : { filter: next });
  };
  const filteredEmployees = useMemo(() => {
    if (filter === 'visa') return withVisa;
    if (filter === 'flagged') return employees.filter(e => flaggedCount(e) > 0);
    return employees;
  }, [filter, employees, withVisa]);

  const columns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (e) => (
        <div>
          <div className="font-medium text-sm">{e.firstName} {e.lastName}</div>
          <div className="text-xs text-gray-400">{e.displayId}</div>
        </div>
      ),
      getValue: (e) => `${e.firstName} ${e.lastName}`,
    },
    {
      key: 'visaType',
      header: 'Visa Type',
      render: (e) => e.visaType ? <Badge variant="outline">{e.visaType.toUpperCase()}</Badge> : <span className="text-xs text-gray-400">—</span>,
      getValue: (e) => e.visaType ?? '',
    },
    {
      key: 'visaExpiry',
      header: 'Visa Expiry',
      render: (e) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{e.visaExpiry ? formatDate(e.visaExpiry) : '—'}</span>
          <ExpiryBadge date={e.visaExpiry} />
        </div>
      ),
      getValue: (e) => e.visaExpiry ?? '',
    },
    {
      key: 'i9Status',
      header: 'I-9 Status',
      render: (e) => e.i9Status ? <span className="text-sm capitalize">{e.i9Status.replace(/_/g, ' ')}</span> : <span className="text-xs text-gray-400">—</span>,
      getValue: (e) => e.i9Status ?? '',
    },
    {
      key: 'eVerifyStatus',
      header: 'E-Verify',
      render: (e) => e.eVerifyStatus ? <span className="text-sm">{E_VERIFY_STATUS_LABELS[e.eVerifyStatus] ?? e.eVerifyStatus}</span> : <span className="text-xs text-gray-400">—</span>,
      getValue: (e) => e.eVerifyStatus ?? '',
    },
    {
      key: 'dependents',
      header: 'Dependents',
      render: (e) => (e.dependents?.length ?? 0) > 0
        ? <span className="text-sm">{e.dependents!.length}</span>
        : <span className="text-xs text-gray-400">—</span>,
      getValue: (e) => String(e.dependents?.length ?? 0),
    },
    {
      key: 'flagged',
      header: 'Flagged Docs',
      render: (e) => {
        const n = flaggedCount(e);
        return n > 0
          ? <Badge variant="destructive" className="gap-1"><FlagTriangleRight className="h-3 w-3" />{n}</Badge>
          : <span className="text-xs text-gray-400">—</span>;
      },
      getValue: (e) => String(flaggedCount(e)),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Legal"
        title="Legal Review"
        description="Review employee immigration documents and flag items for HR's attention."
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => toggleFilter('all')}
          className={`portal-panel text-left transition-shadow ${filter === 'all' ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
        >
          <div className="portal-panel-body flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{isLoading ? '…' : employees.length}</p>
              <p className="text-xs text-muted-foreground">Employees</p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleFilter('visa')}
          className={`portal-panel text-left transition-shadow ${filter === 'visa' ? 'ring-2 ring-violet-500' : 'hover:shadow-md'}`}
        >
          <div className="portal-panel-body flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Scale className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{isLoading ? '…' : withVisa.length}</p>
              <p className="text-xs text-muted-foreground">On a visa</p>
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => toggleFilter('flagged')}
          className={`portal-panel text-left transition-shadow ${filter === 'flagged' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
        >
          <div className="portal-panel-body flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FlagTriangleRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{isLoading ? '…' : flaggedTotal}</p>
              <p className="text-xs text-muted-foreground">Flagged documents</p>
            </div>
          </div>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load employees. Please refresh.</p>
        </div>
      ) : (
        <>
          {filter !== 'all' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                Showing {filteredEmployees.length} {filter === 'visa' ? 'employee(s) on a visa' : 'employee(s) with flagged documents'}
              </span>
              <button type="button" onClick={() => toggleFilter(filter)} className="text-blue-600 hover:underline text-xs font-medium">
                Clear filter
              </button>
            </div>
          )}
          <DataTable
            columns={columns}
            data={filteredEmployees}
            getRowKey={(e) => e.id}
            onRowClick={(e) => navigate(`/portal/legal-review/${e.id}`)}
            emptyTitle={filter === 'all' ? 'No employees found' : 'No employees match this filter'}
            searchPlaceholder="Search by name, visa type…"
            searchKeys={['firstName', 'lastName', 'displayId', 'visaType'] as (keyof Employee)[]}
          />
        </>
      )}
    </div>
  );
}

export default LegalReview;
