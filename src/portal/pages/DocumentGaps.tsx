import { AlertCircle, CheckCircle2, FileSearch, Loader2 } from 'lucide-react';
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_ORDER } from '../lib/documentTypes';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useDocumentGaps,
  type CandidateGap, type UnmetRequirement, type UnknownLabel, type DeclaredNotHeld,
} from '../hooks/useEmployees';

/**
 * What each work-status category requires, against what people in it hold.
 *
 * HR: *"The documents listed under each category still have some gaps, we can
 * have one more call and finalize."* The Yes/No opt-out made those gaps
 * survivable — nobody is blocked by a document that does not apply to them.
 * This makes them visible, which is the half that was missing: a document that
 * should be required and is not on the list is one nobody is ever asked for.
 *
 * It cannot say what the right answer is. It says which questions are worth
 * asking, with names and counts, before the call rather than during it.
 */

const VISA_LABELS: Record<string, string> = {
  h1b: 'H-1B', l1: 'L-1', l2: 'L-2', opt: 'OPT', stem_opt: 'STEM OPT',
  gc: 'Green Card', citizen: 'Citizen', tn: 'TN', h4_ead: 'H-4 EAD', other: 'Other',
};
const visaLabel = (v: string) => VISA_LABELS[v] ?? v;

export default function DocumentGaps() {
  const { data, isLoading, isError, refetch, isFetching } = useDocumentGaps();

  // Added so related findings sit together: the three tables below are keyed
  // by document, and without a group a passport finding sorted next to a pay
  // stub finding for no reason anyone could see.
  const groupColumn = <T extends { category: string }>(): Column<T> => ({
    key: 'category', header: 'Group', sortable: true,
    getValue: (r: T) => String(DOCUMENT_CATEGORY_ORDER[r.category] ?? 99).padStart(2, '0'),
    render: (r: T) => (
      <span className="text-[11px] text-gray-500">
        {DOCUMENT_CATEGORY_LABELS[r.category] ?? r.category}
      </span>
    ),
  });

  const gapColumns: Column<CandidateGap>[] = [
    {
      key: 'visaType', header: 'Category',
      getValue: (r: CandidateGap) => visaLabel(r.visaType),
      render: (r: CandidateGap) => <span className="font-medium">{visaLabel(r.visaType)}</span>,
    },
    groupColumn<CandidateGap>(),
    {
      key: 'documentType', header: 'Document',
      getValue: (r: CandidateGap) => r.documentType,
    },
    {
      key: 'heldPercent', header: 'Held by', sortable: true,
      getValue: (r: CandidateGap) => String(r.heldPercent),
      render: (r: CandidateGap) => (
        <span className="flex items-center gap-2">
          <Badge className={r.heldPercent === 100
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-gray-100 text-gray-700 border-gray-200'}>
            {r.heldBy}/{r.categorySize}
          </Badge>
          <span className="text-xs text-gray-500">{r.heldPercent}%</span>
        </span>
      ),
    },
  ];

  const unmetColumns: Column<UnmetRequirement>[] = [
    {
      key: 'visaType', header: 'Category',
      getValue: (r: UnmetRequirement) => visaLabel(r.visaType),
      render: (r: UnmetRequirement) => <span className="font-medium">{visaLabel(r.visaType)}</span>,
    },
    groupColumn<UnmetRequirement>(),
    { key: 'documentType', header: 'Document', getValue: (r: UnmetRequirement) => r.documentType },
    {
      key: 'missingFor', header: 'Missing for', sortable: true,
      getValue: (r: UnmetRequirement) => String(r.missingFor),
      render: (r: UnmetRequirement) => (
        <Badge variant={r.missingFor === r.categorySize ? 'destructive' : 'secondary'}>
          {r.missingFor} of {r.categorySize}
        </Badge>
      ),
    },
  ];

  const declinedColumns: Column<DeclaredNotHeld>[] = [
    {
      key: 'visaType', header: 'Category',
      getValue: (r: DeclaredNotHeld) => visaLabel(r.visaType),
      render: (r: DeclaredNotHeld) => <span className="font-medium">{visaLabel(r.visaType)}</span>,
    },
    groupColumn<DeclaredNotHeld>(),
    {
      key: 'documentType', header: 'Document',
      getValue: (r: DeclaredNotHeld) => r.documentType,
      render: (r: DeclaredNotHeld) => (
        <span className="flex items-center gap-2 flex-wrap">
          {r.documentType}
          {/* The invariant made visible: a "no" is never allowed to satisfy a
              requirement, so a row here is an answer the gate is correctly
              ignoring — almost always left over from a visa change. */}
          {r.conflictsWithRequirement && (
            <Badge variant="destructive">Required — answer ignored</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'declaredNo', header: 'Answered no', sortable: true,
      getValue: (r: DeclaredNotHeld) => String(r.declaredNo),
      render: (r: DeclaredNotHeld) => (
        <span className="flex items-center gap-2">
          <Badge className={r.percent === 100
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-gray-100 text-gray-700 border-gray-200'}>
            {r.declaredNo} of {r.categorySize}
          </Badge>
          <span className="text-xs text-gray-500">{r.percent}%</span>
        </span>
      ),
    },
  ];

  const unknownColumns: Column<UnknownLabel>[] = [
    { key: 'documentType', header: 'Stored as', getValue: (r: UnknownLabel) => r.documentType },
    {
      key: 'count', header: 'Files', sortable: true,
      getValue: (r: UnknownLabel) => String(r.count),
    },
    {
      key: 'employees', header: 'Employees',
      getValue: (r: UnknownLabel) => r.employees.join(', '),
      render: (r: UnknownLabel) => <span className="text-xs text-gray-500">{r.employees.join(', ')}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Document Gaps"
        description="What each work status requires, against what people in it actually hold. A starting point for deciding the lists — not a verdict on them."
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isLoading && (
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the roster…
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">The report could not be built.</p>
            <p className="text-xs text-red-800 mt-0.5">
              Nothing is affected — this page only reads. Try refreshing.
            </p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Who is in each category, so a percentage can be read honestly:
              "100% of 1 employee" is not the same finding as "100% of 20". */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Roster by work status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.categories.length === 0 && (
                  <p className="text-sm text-gray-400">No employee has a work status set.</p>
                )}
                {data.categories.map(c => (
                  <span key={c.visaType}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-700">
                    {visaLabel(c.visaType)} · {c.employees}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-amber-500" />
                Filed by most of a category, required by nothing
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Candidate gaps. People are providing these anyway, which usually means
                somebody asked for them outside the system.
              </p>
            </CardHeader>
            <CardContent>
              {data.candidateGaps.length === 0 ? (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Nothing is being filed that the lists do not already ask for.
                </p>
              ) : (
                <DataTable
                  data={data.candidateGaps}
                  columns={gapColumns}
                  getRowKey={r => `${r.visaType}-${r.documentType}`}
                  searchKeys={['documentType', 'visaType']}
                  exportFilename="document-gaps"
                  emptyTitle="No candidate gaps"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Required, but not on file</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Either the requirement is wrong for that category, or this is a chase list.
                Both are worth knowing; the report cannot tell which.
              </p>
            </CardHeader>
            <CardContent>
              {data.unmetRequirements.length === 0 ? (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Everyone holds everything their category requires.
                </p>
              ) : (
                <DataTable
                  data={data.unmetRequirements}
                  columns={unmetColumns}
                  getRowKey={r => `${r.visaType}-${r.documentType}`}
                  searchKeys={['documentType', 'visaType']}
                  exportFilename="unmet-requirements"
                  emptyTitle="Nothing outstanding"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Declared not held</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Documents people in that category have said, in as many words, that they do not
                have. A high count is a document the category probably should not be asking for —
                the opposite signal to the first table, and the one the Yes/No answers were
                collecting all along without anywhere to show them.
              </p>
            </CardHeader>
            <CardContent>
              {data.declaredNotHeld.length === 0 ? (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Nobody has answered &ldquo;no&rdquo; to a document yet.
                </p>
              ) : (
                <DataTable
                  data={data.declaredNotHeld}
                  columns={declinedColumns}
                  getRowKey={r => `${r.visaType}-${r.documentType}`}
                  searchKeys={['documentType', 'visaType']}
                  exportFilename="declared-not-held"
                  emptyTitle="No answers yet"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filed under a name the system does not know</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                These are invisible to the onboarding check, so the employee is asked for a
                document they have already uploaded. Not a policy question — a data one.
              </p>
            </CardHeader>
            <CardContent>
              {data.unknownLabels.length === 0 ? (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Every document on file is recognised.
                </p>
              ) : (
                <DataTable
                  data={data.unknownLabels}
                  columns={unknownColumns}
                  getRowKey={r => r.documentType}
                  searchKeys={['documentType']}
                  exportFilename="unrecognised-documents"
                  emptyTitle="All recognised"
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
