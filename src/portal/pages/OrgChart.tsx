import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Briefcase, ChevronDown, ChevronRight,
  Loader2, Network, Search, Users, X,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { DetailField as Field } from '../components/shared/DetailField';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEmployees } from '../hooks/useEmployees';
import { useAssignments } from '../hooks/useAssignments';
import {
  buildOrgTree, matchingIds, descendants, findNode, ancestorsOf,
  type OrgNode, type OrgPerson,
} from '../lib/orgChart';
import { formatDate } from '../lib/utils';

/**
 * Who reports to whom.
 *
 * Tree-building, cycle handling and search live in lib/orgChart.ts so they can
 * be tested without rendering; this file is layout.
 *
 * Two things the first version got wrong, both reported as "confusing":
 * clicking a person navigated away, so the structure could never be studied;
 * and a node carried almost nothing, so the chart answered only "who reports
 * to whom" and no other question anyone actually had.
 */

const fullName = (p: OrgPerson) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unnamed';

/** Level banding, so depth is readable without tracing the lines. */
const DEPTH_ACCENT = [
  'border-t-[#4069FF]',
  'border-t-[#32CDDC]',
  'border-t-emerald-500',
  'border-t-amber-500',
  'border-t-violet-500',
];

function Chip({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'violet' }) {
  const tones = {
    gray: 'text-gray-600 bg-gray-100 border-gray-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    violet: 'text-violet-700 bg-violet-50 border-violet-200',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-1.5 py-0.5 whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

function PersonCard({
  node, collapsed, selected, onToggle, onSelect, dimmed, highlighted,
}: {
  node: OrgNode;
  collapsed: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const { person, directCount, totalCount, depth } = node;
  const accent = DEPTH_ACCENT[depth % DEPTH_ACCENT.length];

  return (
    <div
      className={`inline-block align-top w-[232px] rounded-xl border border-gray-200 border-t-[3px] ${accent} bg-white shadow-sm transition
        ${dimmed ? 'opacity-30' : 'opacity-100'}
        ${selected ? 'ring-2 ring-[#4069FF] ring-offset-1' : highlighted ? 'ring-2 ring-amber-400' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 pt-3 pb-2.5 hover:bg-gray-50/80 rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
        title={`Open ${fullName(person)}`}
      >
        <span className="flex items-center gap-2.5">
          <EmployeeAvatar photoUrl={person.profilePhotoUrl} name={fullName(person)} size="sm" initials />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-gray-900 truncate">{fullName(person)}</span>
            <span className="block text-[11px] text-gray-500 truncate">{person.jobTitle || '—'}</span>
          </span>
        </span>

        <span className="mt-2 flex flex-wrap gap-1">
          {person.displayId && <Chip>{person.displayId}</Chip>}
          {person.department && <Chip tone="blue">{person.department}</Chip>}
          {person.visaType && <Chip tone="violet">{person.visaType.toUpperCase()}</Chip>}
        </span>

        {/* Deliberately no rate: assignments are not redacted for operations,
            who are the main audience for this page. */}
        {person.projectName && (
          <span className="mt-1.5 flex items-start gap-1 text-[10px] text-gray-500">
            <Briefcase className="h-3 w-3 mt-px flex-shrink-0 text-gray-400" />
            <span className="truncate">
              {person.projectName}{person.clientName ? ` · ${person.clientName}` : ''}
            </span>
          </span>
        )}
      </button>

      {directCount > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 border-t border-gray-100 text-[11px] font-medium text-gray-600 hover:bg-gray-50 rounded-b-xl"
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {directCount} direct{directCount === 1 ? '' : 's'}
          {totalCount !== directCount && <span className="text-gray-400">· {totalCount} total</span>}
        </button>
      )}
    </div>
  );
}

function Branch({
  nodes, collapsed, selectedId, toggle, select, hits, searching,
}: {
  nodes: OrgNode[];
  collapsed: Set<string>;
  selectedId: string | null;
  toggle: (id: string) => void;
  select: (id: string) => void;
  hits: Set<string>;
  searching: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map(node => {
        const id = node.person.id;
        const isCollapsed = collapsed.has(id);
        return (
          <li key={id}>
            <PersonCard
              node={node}
              collapsed={isCollapsed}
              selected={selectedId === id}
              onToggle={() => toggle(id)}
              onSelect={() => select(id)}
              dimmed={searching && !hits.has(id)}
              highlighted={searching && hits.has(id)}
            />
            {!isCollapsed && (
              <Branch
                nodes={node.reports}
                collapsed={collapsed}
                selectedId={selectedId}
                toggle={toggle}
                select={select}
                hits={hits}
                searching={searching}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A compact person row, used for the reports list and the breadcrumb. */
function PersonRow({ node, onClick }: { node: OrgNode; onClick: () => void }) {
  const p = node.person;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
    >
      <EmployeeAvatar photoUrl={p.profilePhotoUrl} name={fullName(p)} size="xs" initials />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gray-900 truncate">{fullName(p)}</span>
        <span className="block text-[11px] text-gray-500 truncate">{p.jobTitle || '—'}</span>
      </span>
      {node.directCount > 0 && (
        <span className="text-[10px] text-gray-400 whitespace-nowrap">+{node.totalCount}</span>
      )}
    </button>
  );
}

function DetailPanel({
  node, roots, onSelect, onClose, onOpenRecord,
}: {
  node: OrgNode;
  roots: OrgNode[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onOpenRecord: () => void;
}) {
  const p = node.person;
  const chain = ancestorsOf(roots, p.id);
  const manager = chain.length > 0 ? chain[chain.length - 1] : undefined;
  const indirect = descendants(node).filter(d => !node.reports.includes(d));

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <EmployeeAvatar photoUrl={p.profilePhotoUrl} name={fullName(p)} size="md" initials />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight truncate">{fullName(p)}</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{p.jobTitle || '—'}</p>
            {p.status && <div className="mt-1.5"><StatusBadge status={p.status} /></div>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Where they sit. More useful than any count. */}
        {chain.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1">Reports up through</p>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              {chain.map((a, i) => (
                <span key={a.person.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(a.person.id)}
                    className="text-[#4069FF] hover:underline underline-offset-2"
                  >
                    {fullName(a.person)}
                  </button>
                  {i < chain.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee ID" value={p.displayId} mono />
          <Field label="Department" value={p.department} />
          <Field label="Work Status" value={p.visaType?.toUpperCase()} />
          <Field label="Manager" value={manager ? fullName(manager.person) : 'None — top level'} />
        </div>

        {p.projectName && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1">Currently on</p>
            <p className="text-sm text-gray-900">{p.projectName}</p>
            <p className="text-[11px] text-gray-500">
              {[p.clientName, p.assignmentRole].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.08em] mb-1">
            Team — {node.directCount} direct{node.directCount === 1 ? '' : 's'}
            {indirect.length > 0 && `, ${node.totalCount} in total`}
          </p>
          {node.reports.length === 0 ? (
            <p className="text-sm text-gray-400">Nobody reports to {p.firstName}.</p>
          ) : (
            <div className="-mx-2 max-h-[280px] overflow-y-auto">
              {node.reports.map(r => (
                <PersonRow key={r.person.id} node={r} onClick={() => onSelect(r.person.id)} />
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onOpenRecord}>
          Open full record <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OrgChart() {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useEmployees({ limit: 500 });
  // One request for everyone's current work — the precedent is
  // ApprovedTimesheetsReport. Grouped by employee below.
  const { data: assignmentData } = useAssignments({ status: 'active', limit: 500 });
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const people: OrgPerson[] = useMemo(() => {
    const byEmployee = new Map<string, { projectName?: string; clientName?: string; role?: string }>();
    for (const a of assignmentData?.data ?? []) {
      if (a.employeeId && !byEmployee.has(a.employeeId)) {
        byEmployee.set(a.employeeId, { projectName: a.projectName, clientName: a.clientName, role: a.role });
      }
    }
    return (data?.data ?? [])
      // Terminated people would otherwise hang around as empty boxes.
      .filter(e => e.status !== 'inactive' || !e.terminatedAt)
      .map(e => {
        const asg = byEmployee.get(e.id);
        return {
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          department: e.department,
          displayId: e.displayId,
          profilePhotoUrl: e.profilePhotoUrl,
          status: e.status,
          reportingManagerId: e.reportingManagerId,
          visaType: e.visaType,
          projectName: asg?.projectName,
          clientName: asg?.clientName,
          assignmentRole: asg?.role,
        };
      });
  }, [data, assignmentData]);

  const tree = useMemo(() => buildOrgTree(people), [people]);
  const hits = useMemo(() => matchingIds(tree.roots, query), [tree, query]);
  const searching = query.trim().length > 0;
  const selected = useMemo(
    () => (selectedId ? findNode(tree.roots, selectedId) : undefined),
    [tree, selectedId],
  );

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const collapseAll = () => {
    const ids = new Set<string>();
    const walk = (nodes: OrgNode[]) => nodes.forEach(n => { if (n.reports.length) { ids.add(n.person.id); walk(n.reports); } });
    walk(tree.roots);
    setCollapsed(ids);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Couldn't load the organization chart.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const withProject = people.filter(p => p.projectName).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization Chart"
        description={
          `${people.length} people · ${tree.roots.length} at the top`
          + (withProject > 0 ? ` · ${withProject} on an active project` : '')
        }
        onRefresh={refetch}
        isRefreshing={isFetching}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name, title, team, project…"
                className="pl-8 w-full sm:w-64 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Collapse</Button>
          </div>
        }
      />

      {/* Nobody has a manager set, so there is no hierarchy to draw. Say so and
          point at the fix rather than rendering disconnected boxes and letting
          someone conclude the page is broken. */}
      {tree.isFlat && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <Users className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>No reporting lines have been set yet,</strong> so everyone appears at the top level.
            Open an employee, choose <strong>Edit</strong>, and set their <strong>Reporting Manager</strong>
            {' '}under Employment — the chart builds itself from there.
          </p>
        </div>
      )}

      {tree.cycleIds.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <strong>{tree.cycleIds.length} reporting {tree.cycleIds.length === 1 ? 'line forms a loop' : 'lines form loops'}</strong>
            {' '}— two people have been made each other's manager, directly or through a chain. They are shown at
            the top level until the loop is broken.
          </p>
        </div>
      )}

      {tree.orphanedIds.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            {tree.orphanedIds.length} {tree.orphanedIds.length === 1 ? 'person reports' : 'people report'} to
            someone no longer on the active roster, so they are shown at the top level.
          </p>
        </div>
      )}

      {searching && hits.size === 0 && (
        <p className="text-sm text-gray-500">No one matches &ldquo;{query}&rdquo;.</p>
      )}

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <Network className="h-10 w-10 text-gray-300" />
          <p className="text-sm">No active employees to chart.</p>
        </div>
      ) : (
        /* Master-detail, following HrDocumentsView in Documents.tsx. The chart
           keeps its own horizontal scroll so a wide org stays readable rather
           than being squeezed into the remaining column. */
        <div className={selected ? 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4' : ''}>
          <div className="org-tree overflow-x-auto pb-6 min-w-0">
            <div className="inline-block min-w-full px-4">
              <Branch
                nodes={tree.roots}
                collapsed={collapsed}
                selectedId={selectedId}
                toggle={toggle}
                select={setSelectedId}
                hits={hits}
                searching={searching}
              />
            </div>
          </div>

          {selected && (
            <DetailPanel
              node={selected}
              roots={tree.roots}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
              onOpenRecord={() => navigate(`/portal/employees/${selected.person.id}`)}
            />
          )}
        </div>
      )}
    </div>
  );
}
