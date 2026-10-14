/**
 * Build the reporting hierarchy from a flat employee list.
 *
 * `reporting_manager_id` is free-form — HR picks a manager from a dropdown of
 * the whole roster, with nothing stopping two people being made each other's
 * manager. A naive recursive walk over that data hangs the browser, so the
 * cases that look like paranoia here are the ones that actually happen:
 * cycles, a manager who has left, and (today, before anyone has filled the
 * field in) every single person being a root.
 *
 * Pure and import-free so all of that can be tested without rendering.
 */

export interface OrgPerson {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  displayId?: string;
  profilePhotoUrl?: string;
  status?: string;
  reportingManagerId?: string;
  /** Work status, e.g. h1b — shown as a chip so the visa mix is visible at a glance. */
  visaType?: string;
  /**
   * What this person is currently on, joined client-side from active
   * assignments.
   *
   * Deliberately carries no bill or pay rate. redactEmployee zeroes
   * employee.payRate for the operations role, but assignments are not redacted
   * at all — so putting a rate on a node would leak it through the side door,
   * to precisely the role this page is built for.
   */
  projectName?: string;
  clientName?: string;
  assignmentRole?: string;
}

export interface OrgNode {
  person: OrgPerson;
  reports: OrgNode[];
  /** Direct reports. */
  directCount: number;
  /** Everyone beneath this person, at any depth. */
  totalCount: number;
  /** Depth from the root, 0-based — used for indenting and colour banding. */
  depth: number;
}

export interface OrgTree {
  roots: OrgNode[];
  /** People whose manager is set but points at somebody not in the list
   *  (left the company, or filtered out). They are shown as roots so nobody
   *  silently disappears from the chart. */
  orphanedIds: string[];
  /** People dropped from a cycle to keep the tree finite, e.g. A→B→A. */
  cycleIds: string[];
  /** Nobody has a manager set, so the "chart" is just a list. Lets the view
   *  explain that rather than rendering a meaningless row of boxes. */
  isFlat: boolean;
}

const fullName = (p: OrgPerson) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

/** Alphabetical, so the chart does not reshuffle between renders. */
function sortNodes(nodes: OrgNode[]): OrgNode[] {
  nodes.sort((a, b) => fullName(a.person).localeCompare(fullName(b.person)));
  for (const n of nodes) sortNodes(n.reports);
  return nodes;
}

export function buildOrgTree(people: OrgPerson[]): OrgTree {
  const byId = new Map(people.map(p => [p.id, p]));
  const orphanedIds: string[] = [];
  const cycleIds: string[] = [];

  /**
   * The manager this person should hang off, or null for a root.
   *
   * Walks up the chain first: if following managers ever returns to where it
   * started, the link is part of a cycle and is cut here rather than being
   * discovered by a stack overflow during rendering.
   */
  const effectiveManagerId = (p: OrgPerson): string | null => {
    const managerId = p.reportingManagerId;
    if (!managerId || managerId === p.id) return null; // nobody reports to themselves
    if (!byId.has(managerId)) {
      orphanedIds.push(p.id);
      return null;
    }
    const seen = new Set<string>([p.id]);
    let cursor: string | undefined = managerId;
    while (cursor) {
      if (seen.has(cursor)) {
        cycleIds.push(p.id);
        return null;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.reportingManagerId;
    }
    return managerId;
  };

  const nodes = new Map<string, OrgNode>(
    people.map(p => [p.id, { person: p, reports: [], directCount: 0, totalCount: 0, depth: 0 }]),
  );

  const roots: OrgNode[] = [];
  for (const p of people) {
    const node = nodes.get(p.id)!;
    const managerId = effectiveManagerId(p);
    if (managerId) nodes.get(managerId)!.reports.push(node);
    else roots.push(node);
  }

  // Depths and subtree sizes in one pass each.
  const measure = (node: OrgNode, depth: number): number => {
    node.depth = depth;
    node.directCount = node.reports.length;
    node.totalCount = node.reports.reduce((sum, r) => sum + measure(r, depth + 1) + 1, 0);
    return node.totalCount;
  };
  for (const r of roots) measure(r, 0);

  return {
    roots: sortNodes(roots),
    orphanedIds,
    cycleIds,
    isFlat: roots.length === people.length && people.length > 0,
  };
}

/** Flatten to a render order, skipping anything under a collapsed node. */
export function visibleNodes(roots: OrgNode[], collapsed: ReadonlySet<string>): OrgNode[] {
  const out: OrgNode[] = [];
  const walk = (nodes: OrgNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (!collapsed.has(n.person.id)) walk(n.reports);
    }
  };
  walk(roots);
  return out;
}

/** Everyone beneath this node, flattened — the detail panel's team list. */
export function descendants(node: OrgNode): OrgNode[] {
  const out: OrgNode[] = [];
  const walk = (n: OrgNode) => n.reports.forEach(r => { out.push(r); walk(r); });
  walk(node);
  return out;
}

/** Find one node anywhere in the forest, by person id. */
export function findNode(roots: OrgNode[], id: string): OrgNode | undefined {
  for (const r of roots) {
    if (r.person.id === id) return r;
    const hit = findNode(r.reports, id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The chain of managers above this person, outermost first.
 *
 * Shown as a breadcrumb in the detail panel: knowing someone has four reports
 * matters much less than knowing where they sit.
 */
export function ancestorsOf(roots: OrgNode[], id: string): OrgNode[] {
  const path: OrgNode[] = [];
  const walk = (nodes: OrgNode[], trail: OrgNode[]): boolean => {
    for (const n of nodes) {
      if (n.person.id === id) { path.push(...trail); return true; }
      if (walk(n.reports, [...trail, n])) return true;
    }
    return false;
  };
  walk(roots, []);
  return path;
}

/** Ids of everyone matching a search, plus their ancestors so they stay reachable. */
export function matchingIds(roots: OrgNode[], query: string): Set<string> {
  const needle = query.trim().toLowerCase();
  if (!needle) return new Set();
  const hits = new Set<string>();
  const walk = (node: OrgNode, ancestors: string[]): void => {
    const haystack = [
      fullName(node.person),
      node.person.jobTitle ?? '',
      node.person.department ?? '',
      node.person.displayId ?? '',
      node.person.projectName ?? '',
      node.person.clientName ?? '',
    ].join(' ').toLowerCase();
    if (haystack.includes(needle)) {
      hits.add(node.person.id);
      for (const a of ancestors) hits.add(a);
    }
    for (const r of node.reports) walk(r, [...ancestors, node.person.id]);
  };
  for (const r of roots) walk(r, []);
  return hits;
}
