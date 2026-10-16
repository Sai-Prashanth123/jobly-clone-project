import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { collectRoutes, buildKeys } from '../../scripts/generatePermissions.mjs';
import { FALLBACK_GRANTS, buildPermissionIndex, wouldOrphanAdmin, UNREVOKABLE_PERMISSION } from './permissions';

/**
 * The gate for the whole permissions project.
 *
 * Nothing may read the permission tables until this passes, and it must keep
 * passing while the route guards are swapped over. The claim it defends is
 * narrow and total: FOR EVERY GUARDED ROUTE AND EVERY ROLE, the permission
 * model answers exactly what requireRole answers today.
 *
 * This matters more than usual here. The matrix on the Admin Settings screen
 * and the code disagree in both directions — the screen says Activity Logs is
 * admin-only where requireRole admits HR, and omits HR from reports where the
 * routes allow it. Seeding from the screen would have moved 113 of 256 routes
 * on day one and taken 30 away from HR, which is the shape of the document
 * regression HR reported in October. So the seed comes from the code, and this
 * test is what says so.
 *
 * It replaces roleParity.test.ts, which read the route files as text and
 * therefore breaks the moment requireRole calls are replaced.
 */

const ROUTES_DIR = path.join(import.meta.dirname, '..', 'routes');
const routes = collectRoutes(ROUTES_DIR);
const keys = buildKeys(routes);
const ROLES = ['admin', 'hr', 'operations', 'finance', 'legal', 'employee'];

describe('the route scan itself', () => {
  // If this number falls, a guard style has stopped being recognised and the
  // routes behind it would seed with no permission at all. That has already
  // happened twice while building this: aliased guards hid 44 routes and
  // router.use guards hid 39 more.
  it('finds every guarded route', () => {
    expect(routes.length).toBe(265);
  });

  it('resolves roles for every route it reports', () => {
    const bad = routes.filter(r => !Array.isArray(r.roles) || r.roles.length === 0);
    expect(bad.map(r => `${r.file} ${r.method} ${r.path}`)).toEqual([]);
  });

  it('covers all three guard styles', () => {
    // inline, aliased (cases), and router-wide (admin).
    expect(routes.some(r => r.file === 'admin.routes.ts')).toBe(true);
    expect(routes.some(r => r.file === 'enrollmentForms.routes.ts')).toBe(true);
    expect(routes.filter(r => r.file === 'offboarding.routes.ts').length).toBeGreaterThan(0);
  });
});

describe('the generated keys', () => {
  it('grants nobody nothing — no key is dead', () => {
    const dead = Object.entries(keys).filter(([, r]) => r.length === 0);
    expect(dead.map(([k]) => k)).toEqual([]);
  });

  it('matches the committed FALLBACK_GRANTS, so the file is not stale', () => {
    const generated = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [...v].sort()]));
    const committed = Object.fromEntries(
      Object.entries(FALLBACK_GRANTS).map(([k, v]) => [k, [...v].sort()]),
    );
    expect(committed).toEqual(generated);
  });
});

/**
 * The parity claim, stated route by route.
 *
 * Every guarded route must be covered by a key whose grant is EXACTLY that
 * route's role set — not a superset (somebody gains access) and not a subset
 * (somebody loses it).
 */
describe('every route resolves identically under the permission model', () => {
  const keyFor = (r: { file: string; method: string; path: string }) => {
    const res = r.file.replace(/\.routes\.ts$/, '');
    const act = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' }[r.method]!;
    const slug = r.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
    for (const candidate of [`${res}.${act}.${slug}`, `${res}.${act}`, `${res}.manage`]) {
      if (candidate in keys) return candidate;
    }
    return null;
  };

  it('finds a key for every route', () => {
    const orphans = routes.filter(r => keyFor(r) === null);
    expect(orphans.map(r => `${r.file} ${r.method} ${r.path}`)).toEqual([]);
  });

  it('gives every role the same answer it gets today, on every route', () => {
    const index = buildPermissionIndex([], FALLBACK_GRANTS);  // empty DB → fallback
    const disagreements: string[] = [];
    for (const r of routes) {
      const key = keyFor(r);
      if (!key) continue;
      for (const role of ROLES) {
        const today = r.roles.includes(role);
        const model = index(role, key);
        if (today !== model) {
          disagreements.push(`${r.file} ${r.method} ${r.path} [${role}] today=${today} model=${model} key=${key}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });
});

describe('the database answer, and what happens without one', () => {
  it('uses the stored grant when the key is known', () => {
    const index = buildPermissionIndex(
      [{ role_key: 'hr', permission_key: 'clients.view', granted: false }],
      { 'clients.view': ['admin', 'hr'] },
    );
    expect(index('hr', 'clients.view')).toBe(false);   // the admin's decision
    expect(index('admin', 'clients.view')).toBe(false); // no row → not granted
  });

  // A database problem must not become an outage, and must not become a
  // free-for-all either.
  it('falls back to the compiled-in tuple when the table is empty', () => {
    const index = buildPermissionIndex([], { 'clients.view': ['admin', 'hr'] });
    expect(index('admin', 'clients.view')).toBe(true);
    expect(index('employee', 'clients.view')).toBe(false);
  });

  it('falls back per KEY, not per table', () => {
    const index = buildPermissionIndex(
      [{ role_key: 'hr', permission_key: 'clients.view', granted: true }],
      { 'clients.view': ['admin'], 'invoices.view': ['finance'] },
    );
    expect(index('hr', 'clients.view')).toBe(true);      // stored decision kept
    expect(index('finance', 'invoices.view')).toBe(true); // missing key falls back
  });

  it('refuses a permission nobody has ever heard of', () => {
    const index = buildPermissionIndex([], {});
    expect(index('admin', 'something.invented')).toBe(false);
  });
});

describe('admin cannot lose admin', () => {
  const rows = [
    { role_key: 'admin', permission_key: UNREVOKABLE_PERMISSION, granted: true },
    { role_key: 'hr', permission_key: UNREVOKABLE_PERMISSION, granted: false },
  ];

  it('refuses to revoke the last grant', () => {
    expect(wouldOrphanAdmin(rows, {
      role_key: 'admin', permission_key: UNREVOKABLE_PERMISSION, granted: false,
    })).toBe(true);
  });

  it('allows it while another role still holds it', () => {
    const shared = [...rows, { role_key: 'hr', permission_key: UNREVOKABLE_PERMISSION, granted: true }];
    expect(wouldOrphanAdmin(shared, {
      role_key: 'admin', permission_key: UNREVOKABLE_PERMISSION, granted: false,
    })).toBe(false);
  });

  it('does not interfere with any other permission', () => {
    expect(wouldOrphanAdmin(rows, {
      role_key: 'admin', permission_key: 'clients.view', granted: false,
    })).toBe(false);
  });

  it('never blocks a grant, only a revoke', () => {
    expect(wouldOrphanAdmin(rows, {
      role_key: 'admin', permission_key: UNREVOKABLE_PERMISSION, granted: true,
    })).toBe(false);
  });
});
