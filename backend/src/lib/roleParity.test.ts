import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Role-parity: a role the FRONTEND lets into a page must be a role the BACKEND
// lets into that page's endpoints.
//
// This exists because HR was allowed onto /portal/reports while all nine
// backend report routes excluded hr — so HR opened the page and every panel
// 403'd. Nobody noticed, because the two lists live in different trees and
// nothing compared them.
//
// Deliberately parsed from source rather than imported: PortalApp.tsx is TSX
// full of components, and the route files pull in controllers, the DB client
// and the whole service layer. Reading the text keeps this test free of both.
// That makes it a little brittle to reformatting, which is an acceptable trade
// for a check that would have caught a live user-facing bug.
const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Every role named in any requireRole(...) in a route file. */
function backendRoles(routeFile: string): Set<string> {
  const src = read(join('backend', 'src', 'routes', routeFile));
  const roles = new Set<string>();
  for (const call of src.matchAll(/requireRole\(([^)]*)\)/g)) {
    for (const role of call[1].matchAll(/'([a-z_]+)'/g)) roles.add(role[1]);
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
