import { describe, it, expect } from 'vitest';
import { buildOrgTree, visibleNodes, matchingIds, type OrgPerson } from './orgChart';

/**
 * The manager field is a dropdown over the whole roster with nothing stopping
 * two people being made each other's manager, so a cycle is one mis-click
 * away — and a recursive render over a cycle hangs the browser rather than
 * failing visibly. These cover the shapes real data takes.
 */
const p = (id: string, name: string, reportingManagerId?: string, extra: Partial<OrgPerson> = {}): OrgPerson => ({
  id,
  firstName: name,
  lastName: 'X',
  reportingManagerId,
  ...extra,
});

describe('building the hierarchy', () => {
  it('nests reports under their manager', () => {
    const tree = buildOrgTree([p('1', 'Maheswari'), p('2', 'Priya', '1'), p('3', 'Sreekanth', '1')]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].reports.map(r => r.person.firstName).sort()).toEqual(['Priya', 'Sreekanth']);
  });

  it('counts directs and the whole subtree separately', () => {
    // Maheswari → Priya → Anushma, and Maheswari → Sreekanth
    const tree = buildOrgTree([
      p('1', 'Maheswari'), p('2', 'Priya', '1'), p('3', 'Sreekanth', '1'), p('4', 'Anushma', '2'),
    ]);
    const root = tree.roots[0];
    expect(root.directCount).toBe(2);
    expect(root.totalCount).toBe(3);
    const priya = root.reports.find(r => r.person.firstName === 'Priya')!;
    expect(priya.directCount).toBe(1);
    expect(priya.totalCount).toBe(1);
  });

  it('records depth for indenting', () => {
    const tree = buildOrgTree([p('1', 'A'), p('2', 'B', '1'), p('3', 'C', '2')]);
    expect(tree.roots[0].depth).toBe(0);
    expect(tree.roots[0].reports[0].depth).toBe(1);
    expect(tree.roots[0].reports[0].reports[0].depth).toBe(2);
  });

  it('supports more than one root — the company has no single top today', () => {
    const tree = buildOrgTree([p('1', 'A'), p('2', 'B'), p('3', 'C', '1')]);
    expect(tree.roots.map(r => r.person.firstName)).toEqual(['A', 'B']);
  });

  it('sorts siblings by name so the chart does not reshuffle', () => {
    const tree = buildOrgTree([p('1', 'Zara'), p('2', 'Adam'), p('3', 'Mia')]);
    expect(tree.roots.map(r => r.person.firstName)).toEqual(['Adam', 'Mia', 'Zara']);
  });
});

describe('the shapes that would otherwise break it', () => {
  // The state the data is in right now: nobody has a manager set.
  it('flags a roster where nobody has a manager', () => {
    const tree = buildOrgTree([p('1', 'A'), p('2', 'B'), p('3', 'C')]);
    expect(tree.isFlat).toBe(true);
    expect(tree.roots).toHaveLength(3);
  });

  it('is not flat as soon as one link exists', () => {
    expect(buildOrgTree([p('1', 'A'), p('2', 'B', '1')]).isFlat).toBe(false);
  });

  // A two-person cycle: the classic mis-click.
  it('survives A reporting to B and B reporting to A', () => {
    const tree = buildOrgTree([p('1', 'A', '2'), p('2', 'B', '1')]);
    expect(tree.cycleIds.length).toBeGreaterThan(0);
    expect(tree.roots.length).toBeGreaterThan(0);
    const total = tree.roots.reduce((n, r) => n + r.totalCount + 1, 0);
    expect(total).toBe(2); // everyone still appears exactly once
  });

  it('survives a longer cycle', () => {
    const tree = buildOrgTree([p('1', 'A', '3'), p('2', 'B', '1'), p('3', 'C', '2')]);
    const total = tree.roots.reduce((n, r) => n + r.totalCount + 1, 0);
    expect(total).toBe(3);
  });

  it('refuses to let anyone be their own manager', () => {
    const tree = buildOrgTree([p('1', 'A', '1')]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].totalCount).toBe(0);
  });

  // A manager who has left, or is filtered out of the current view.
  it('promotes someone whose manager is missing, rather than dropping them', () => {
    const tree = buildOrgTree([p('2', 'B', 'gone')]);
    expect(tree.orphanedIds).toEqual(['2']);
    expect(tree.roots.map(r => r.person.firstName)).toEqual(['B']);
  });

  it('handles an empty roster', () => {
    const tree = buildOrgTree([]);
    expect(tree.roots).toEqual([]);
    expect(tree.isFlat).toBe(false);
  });

  // Whatever the data, everyone must appear exactly once — a chart that
  // quietly omits a person is worse than no chart.
  it('shows every person exactly once across every shape', () => {
    const rosters: OrgPerson[][] = [
      [p('1', 'A'), p('2', 'B', '1'), p('3', 'C', '2')],
      [p('1', 'A', '2'), p('2', 'B', '1')],
      [p('1', 'A', 'missing'), p('2', 'B')],
      [p('1', 'A'), p('2', 'B'), p('3', 'C')],
    ];
    for (const roster of rosters) {
      const tree = buildOrgTree(roster);
      const seen = visibleNodes(tree.roots, new Set()).map(n => n.person.id).sort();
      expect(seen).toEqual(roster.map(x => x.id).sort());
    }
  });
});

describe('collapsing', () => {
  const tree = buildOrgTree([p('1', 'A'), p('2', 'B', '1'), p('3', 'C', '2')]);

  it('shows everything when nothing is collapsed', () => {
    expect(visibleNodes(tree.roots, new Set())).toHaveLength(3);
  });

  it('hides a whole branch, not just the next level', () => {
    const shown = visibleNodes(tree.roots, new Set(['1'])).map(n => n.person.firstName);
    expect(shown).toEqual(['A']);
  });

  it('collapses mid-tree', () => {
    const shown = visibleNodes(tree.roots, new Set(['2'])).map(n => n.person.firstName);
    expect(shown).toEqual(['A', 'B']);
  });
});

describe('search', () => {
  const tree = buildOrgTree([
    p('1', 'Maheswari'),
    p('2', 'Priya', '1', { jobTitle: 'Salesforce Functional', department: 'Delivery' }),
    p('3', 'Sreekanth', '1', { jobTitle: 'Production Support', displayId: 'EMP-0042' }),
  ]);

  it('matches on name, title, department and employee id', () => {
    expect(matchingIds(tree.roots, 'priya').has('2')).toBe(true);
    expect(matchingIds(tree.roots, 'salesforce').has('2')).toBe(true);
    expect(matchingIds(tree.roots, 'delivery').has('2')).toBe(true);
    expect(matchingIds(tree.roots, 'emp-0042').has('3')).toBe(true);
  });

  // A match deep in the tree is useless if its parents are collapsed above it.
  it('keeps ancestors so a match stays reachable', () => {
    const hits = matchingIds(tree.roots, 'priya');
    expect(hits.has('1')).toBe(true);
  });

  it('is case insensitive and ignores surrounding space', () => {
    expect(matchingIds(tree.roots, '  PRIYA ').has('2')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(matchingIds(tree.roots, '   ').size).toBe(0);
  });
});
