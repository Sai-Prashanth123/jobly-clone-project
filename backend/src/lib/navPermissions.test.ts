import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The sidebar's permission keys must not move anybody.
 *
 * A nav item shows when its role list allows AND its permission is held. The
 * two answer different questions — "should this page be offered to this role"
 * versus "may this role call these endpoints" — and across the whole sidebar
 * they disagree on eleven items. Replacing one with the other would have put
 * the client book in front of every employee and taken Reports away from HR.
 *
 * So keys are attached only where the two ALREADY agree, and this test is what
 * holds that line: for every item carrying a key, the API's audience must
 * equal the nav's. Attach a key to an item where they differ and this fails,
 * naming both lists — which is the conversation that should happen before
 * anybody's sidebar changes.
 */

// Lives in the backend suite, like roleParity.test.ts, because it reads files
// from disk — the frontend tsconfig has no node types, and this is the
// established home for a check that spans both trees.
const repo = join(__dirname, '..', '..', '..');
const nav = readFileSync(join(repo, 'src', 'portal', 'components', 'layout', 'PortalSidebar.tsx'), 'utf8');
const perms = readFileSync(join(__dirname, 'permissions.ts'), 'utf8');

const API: Record<string, string[]> = {};
const block = perms.match(/FALLBACK_GRANTS[\s\S]*?\n\}\);/)![0];
for (const m of block.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
  API[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
}

interface Item { label: string; permission: string; roles: string[] }
const items: Item[] = [];
for (const m of nav.matchAll(/\{ label: '([^']+)',\s*path: '[^']*',\s*permission: '([^']+)',[\s\S]{0,200}?roles: \[([^\]]*)\]/g)) {
  items.push({
    label: m[1],
    permission: m[2],
    roles: [...m[3].matchAll(/'([^']+)'/g)].map(x => x[1]).sort(),
  });
}

describe('nav items carrying a permission key', () => {
  it('finds them — a scan returning nothing would pass vacuously', () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
  });

  it('references a permission that exists', () => {
    const unknown = items.filter(i => !(i.permission in API));
    expect(unknown.map(i => `${i.label} → ${i.permission}`)).toEqual([]);
  });

  // The line this test exists to hold.
  it('grants exactly what the nav already granted — no page moves', () => {
    const moved = items
      .filter(i => API[i.permission] && API[i.permission].join() !== i.roles.join())
      .map(i => `${i.label}: nav=[${i.roles}] api=[${API[i.permission]}]`);
    expect(moved).toEqual([]);
  });
});

describe('the intersection itself', () => {
  const shows = (roles: string[], permission: string | undefined, role: string, held: string[] | undefined) => {
    if (!roles.includes(role)) return false;
    if (!permission || !held?.length) return true;
    return held.includes(permission);
  };

  it('hides a page when the permission is revoked', () => {
    expect(shows(['admin', 'hr'], 'employees.view', 'hr', ['clients.view'])).toBe(false);
  });

  it('shows it when the permission is held', () => {
    expect(shows(['admin', 'hr'], 'employees.view', 'hr', ['employees.view'])).toBe(true);
  });

  // Granting must not be enough on its own — that is what keeps a revoke cheap
  // and a grant deliberate.
  it('does not show a page the role list excludes, however permissive the grant', () => {
    expect(shows(['admin'], 'employees.view', 'hr', ['employees.view'])).toBe(false);
  });

  // An old session, or the API unreachable, must not empty the sidebar.
  it('falls back to roles when the session carries no permissions', () => {
    expect(shows(['admin', 'hr'], 'employees.view', 'hr', undefined)).toBe(true);
    expect(shows(['admin', 'hr'], 'employees.view', 'hr', [])).toBe(true);
  });

  it('leaves items with no permission key alone', () => {
    expect(shows(['admin', 'hr'], undefined, 'hr', ['nothing.relevant'])).toBe(true);
  });
});
