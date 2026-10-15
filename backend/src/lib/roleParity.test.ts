import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectRoutes } from '../../scripts/generatePermissions.mjs';

// Role-parity: a role the FRONTEND lets into a page must be a role the BACKEND
// lets into that page's endpoints.
//
// This exists because HR was allowed onto /portal/reports while all nine
// backend report routes excluded hr — so HR opened the page and every panel
// 403'd. Nobody noticed, because the two lists live in different trees and
// nothing compared them.
//
// REWRITTEN for requirePermission. The original read the route files as text
// and matched `requireRole(...)`, so it broke the moment the call sites moved
// — the failure mode being the dangerous one: with no requireRole left to
// find, the backend role set came out EMPTY and every page looked stranded.
// A check that silently stops checking is worse than no check, so this reads
// the same inventory the permission model is built from, which understands
// all three guard styles and both guard functions.
//
// The frontend is still parsed from source: PortalApp.tsx is TSX full of
// components, and importing it here would drag in the whole UI tree.
const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const ROUTES = collectRoutes(join(__dirname, '..', 'routes'));

/** Every role admitted by any guarded route in a route file. */
function backendRoles(routeFile: string): Set<string> {
  const roles = new Set<string>();
  for (const r of ROUTES.filter((x: { file: string }) => x.file === routeFile)) {
    for (const role of r.roles) roles.add(role);
  }
  return roles;
}

/** The allowedRoles on the first <Route path="..."> matching `path`. */
function frontendRoles(path: string): Set<string> {
  const src = read(join('src', 'portal', 'PortalApp.tsx'));
  const at = src.indexOf(`path="${path}"`);
  if (at === -1) throw new Error(`No <Route path="${path}"> in PortalApp.tsx`);
  const window = src.slice(at, at + 400);
  const m = window.match(/allowedRoles=\{\[([^\]]*)\]\}/);
  if (!m) return new Set();            // unguarded route — open to all roles
  return new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]));
}

// Page -> the route file backing it. Only pages whose data comes from one
// route group; mixed pages would need per-endpoint assertions.
const PAGES: Array<{ page: string; routes: string }> = [
  { page: 'reports', routes: 'reports.routes.ts' },
  { page: 'clients', routes: 'clients.routes.ts' },
  { page: 'skills', routes: 'skills.routes.ts' },
  { page: 'shifts', routes: 'shifts.routes.ts' },
  { page: 'tax-documents', routes: 'taxDocuments.routes.ts' },
];

describe('frontend route roles are backed by the API', () => {
  // The guard on the guard. If the inventory ever comes back empty for a file
  // the tests below would all pass vacuously, which is exactly how the
  // previous version of this file would have failed after the swap.
  it.each(PAGES)('$routes is actually readable by the scanner', ({ routes }) => {
    expect(backendRoles(routes).size, `no guarded routes found in ${routes}`).toBeGreaterThan(0);
  });

  it.each(PAGES)('$page: every role the UI admits can reach $routes', ({ page, routes }) => {
    const ui = frontendRoles(page);
    const api = backendRoles(routes);
    const stranded = [...ui].filter(r => !api.has(r));
    expect(
      stranded,
      `${stranded.join(', ')} can open /portal/${page} but no endpoint in ${routes} admits them — ` +
      'they will see a page where every request 403s',
    ).toEqual([]);
  });
});
