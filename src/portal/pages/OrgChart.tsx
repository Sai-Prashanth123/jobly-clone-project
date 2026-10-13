import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronRight, Loader2, Network, Search, Users } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEmployees } from '../hooks/useEmployees';
import { buildOrgTree, matchingIds, type OrgNode } from '../lib/orgChart';

/**
 * Who reports to whom, drawn from `reportingManagerId`.
 *
 * The tree-building, cycle handling and search live in lib/orgChart.ts so they
 * can be tested without rendering; this file is layout only.
 */

/** Banding by depth, so levels are distinguishable without reading the lines. */
const DEPTH_ACCENT = [
  'border-t-[#4069FF]',
  'border-t-emerald-500',
  'border-t-amber-500',
  'border-t-violet-500',
  'border-t-rose-500',
];

function PersonCard({
  node, collapsed, onToggle, onOpen, dimmed, highlighted,
}: {
  node: OrgNode;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: () => void;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const { person, directCount, totalCount, depth } = node;
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unnamed';
  const initials = person.avatarInitials
    || `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase()
    || '?';
  const accent = DEPTH_ACCENT[depth % DEPTH_ACCENT.length];

  return (
    <div
      className={`inline-block align-top w-[208px] rounded-xl border border-gray-200 border-t-[3px] ${accent} bg-white shadow-sm transition
        ${dimmed ? 'opacity-35' : 'opacity-100'}
        ${highlighted ? 'ring-2 ring-[#4069FF] ring-offset-1' : ''}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left px-3 pt-3 pb-2 hover:bg-gray-50/80 rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4069FF]"
        title={`Open ${name}'s record`}
      >
        <div className="flex items-center gap-2.5">
          {person.profilePhotoUrl ? (
            <img src={person.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-gradient-to-br from-[#4069FF] to-[#6b8cff] text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
              {initials}
            </span>
          )}
          <span className="min-w-0 text-left">
            <span className="block text-[13px] font-semibold text-gray-900 truncate">{name}</span>
            <span className="block text-[11px] text-gray-500 truncate">{person.jobTitle || '—'}</span>
          </span>
        </div>
        {(person.department || person.displayId) && (
          <p className="mt-1.5 text-[10px] text-gray-400 truncate">
            {[person.displayId, person.department].filter(Boolean).join(' · ')}
          </p>
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
  nodes, collapsed, toggle, open, hits, searching,
}: {
  nodes: OrgNode[];
  collapsed: Set<string>;
  toggle: (id: string) => void;
  open: (id: string) => void;
  hits: Set<string>;
  searching: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map(node => {
        const isCollapsed = collapsed.has(node.person.id);
        const isHit = hits.has(node.person.id);
        return (
          <li key={node.person.id}>
            <PersonCard
              node={node}
              collapsed={isCollapsed}
              onToggle={() => toggle(node.person.id)}
              onOpen={() => open(node.person.id)}
              dimmed={searching && !isHit}
              highlighted={searching && isHit}
            />
            {!isCollapsed && (
              <Branch
                nodes={node.reports}
                collapsed={collapsed}
                toggle={toggle}
                open={open}
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

export default function OrgChart() {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useEmployees({ limit: 500 });
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Terminated people would otherwise hang around as empty boxes.
  const people = useMemo(
    () => (data?.data ?? []).filter(e => e.status !== 'inactive' || !e.terminatedAt),
    [data],
  );
  const tree = useMemo(() => buildOrgTree(people), [people]);
  const hits = useMemo(() => matchingIds(tree.roots, query), [tree, query]);
  const searching = query.trim().length > 0;

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization Chart"
        description={`${people.length} people${tree.isFlat ? '' : ` · ${tree.roots.length} at the top`}`}
        onRefresh={refetch}
        isRefreshing={isFetching}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find a person, title or team…"
                className="pl-8 w-full sm:w-64 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Collapse</Button>
          </div>
        }
      />

      {/* Nobody has a manager set, so there is no hierarchy to draw yet. Say so
          plainly and point at the fix, rather than rendering a meaningless row
          of disconnected boxes and letting someone conclude it is broken. */}
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
            someone who is no longer on the active roster, so they are shown at the top level.
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
        /* Horizontal scroll rather than shrinking the cards: a wide org is
           wide, and unreadable boxes help nobody. */
        <div className="org-tree overflow-x-auto pb-6">
          <div className="inline-block min-w-full px-4">
            <Branch
              nodes={tree.roots}
              collapsed={collapsed}
              toggle={toggle}
              open={id => navigate(`/portal/employees/${id}`)}
              hits={hits}
              searching={searching}
            />
          </div>
        </div>
      )}
    </div>
  );
}
