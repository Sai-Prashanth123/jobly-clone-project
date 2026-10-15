/**
 * Regenerate FALLBACK_GRANTS in src/lib/permissions.ts from the live route
 * guards.
 *
 * The fallback has to describe what the code enforces, so it is read OUT of
 * the code rather than maintained beside it. Run after changing any
 * requireRole call:  node scripts/generatePermissions.mjs
 *
 * THREE guard styles exist here and all three must be resolved, because a
 * route whose guard is not found seeds with NO permission at all:
 *
 *   inline        router.get('/', requireRole('admin','hr'), ctrl.x)
 *   by alias      const ADMIN_HR = requireRole('admin','hr')      (14 files)
 *                 router.get('/', ADMIN_HR, ctrl.x)
 *   router-wide   router.use(requireRole('admin'))                 (8 files)
 *                 router.get('/users', ctrl.x)   ← nothing on the line itself
 *
 * Missing the alias style alone hid 44 guarded routes; missing the router-wide
 * style hid 39 more. permissions.parity.test.ts fails if any guarded route is
 * left unresolved, so this cannot quietly regress.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'src', 'routes');
const OUT = path.join(import.meta.dirname, '..', 'src', 'lib', 'permissions.ts');

const ACTION = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

/** Every guarded route, with the roles its guard admits. */
export function collectRoutes(dir = DIR) {
  const routes = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.routes.ts'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');

    const wide = src.match(/router\.use\(\s*requireRole\(([^)]*)\)\s*\)/);
    const routerRoles = wide ? [...wide[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;

    const aliases = new Map();
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*requireRole\(([^)]*)\)/g)) {
      aliases.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]));
    }

    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,/g)) {
      const after = m.index + m[0].length;
      // The middleware list, however it is laid out.
      //
      // Reading only to end-of-line missed routes whose arguments are spread
      // over several lines, which is the house style for the longer ones —
      // three of the four routes on permissions.routes.ts were invisible that
      // way. Reading a fixed window instead, cut at the handler body, so an
      // inline `async (req, res) => {` cannot drag the scan into code that
      // merely mentions a role name.
      const window = src.slice(after, after + 400);
      const handler = window.search(/async\s*\(|\(\s*req\s*[,:)]|=>\s*\{/);
      const rest = handler === -1 ? window : window.slice(0, handler);

      let roles = null;

      // requirePermission('some.key', 'admin', 'hr') — the trailing arguments
      // ARE the old role list, kept as the fallback. Reading them keeps this
      // scan complete while the 256 call sites are swapped a file at a time;
      // without it, every swapped route would vanish from the inventory and
      // the parity test would pass by having nothing left to check. That is
      // precisely how the old roleParity.test.ts would have failed silently.
      const byPermission = rest.match(/requirePermission\(\s*'[^']+'\s*,([^)]*)\)/);
      if (byPermission) roles = [...byPermission[1].matchAll(/'([^']+)'/g)].map(x => x[1]);

      const inline = !roles && rest.match(/requireRole\(([^)]*)\)/);
      if (inline) roles = [...inline[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
      if (!roles) {
        for (const [name, r] of aliases) {
          if (new RegExp(`(^|[,\\s(])${name}([,\\s)])`).test(rest)) { roles = r; break; }
        }
      }
      if (!roles) roles = routerRoles;
      if (!roles) continue;  // genuinely unguarded: login, /me, notifications…

      routes.push({ file, method: m[1].toUpperCase(), path: m[2], roles });
    }
  }
  return routes;
}

/**
 * Collapse routes into permission keys.
 *
 * A key's grant is the INTERSECTION of its routes' role sets. A role that
 * cannot reach every route under a key must not be ticked for it, or folding
 * would hand somebody access they do not have today.
 *
 * When that intersection comes out EMPTY the routes genuinely have different
 * audiences and must not share a key, so they stay split by method.
 */
export function buildKeys(routes) {
  // Group first, so routes under one (resource, action) that have genuinely
  // DIFFERENT audiences can be separated instead of intersected to nothing.
  //
  // enrollmentForms is the real case: POST / is admin+hr (HR issues a form)
  // while POST /:id/submit is employee-only (an admin should not fill in
  // somebody's own form). Both are POST, so they collided on one key and the
  // intersection emptied — a permission granting nobody, which as a fallback
  // would have locked both routes for everyone.
  const groups = new Map();
  for (const r of routes) {
    const base = `${r.file.replace(/\.routes\.ts$/, '')}.${ACTION[r.method]}`;
    if (!groups.has(base)) groups.set(base, new Map());
    const sig = [...r.roles].sort().join(',');
    const bucket = groups.get(base);
    if (!bucket.has(sig)) bucket.set(sig, []);
    bucket.get(sig).push(r);
  }

  const byResAct = new Map();
  for (const [base, bucket] of groups) {
    if (bucket.size === 1) {
      byResAct.set(base, new Set(bucket.values().next().value[0].roles));
      continue;
    }
    // More than one audience: give the minority routes their own key, named
    // after the path so the screen says which route it governs.
    const sorted = [...bucket.entries()].sort((a, b) => b[1].length - a[1].length);
    byResAct.set(base, new Set(sorted[0][1][0].roles));
    // A key per ROUTE, not per audience group. Naming the key after only the
    // first route of a group left its siblings with no key of their own, so
    // they fell through to the base key and silently changed audience — 16
    // routes did exactly that, including GET /employees/:id, which would have
    // lost finance and the employee themselves.
    for (const [, rs] of sorted.slice(1)) {
      for (const r of rs) {
        const slug = r.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
        byResAct.set(`${base}.${slug}`, new Set(r.roles));
      }
    }
  }

  const byRes = new Map();
  for (const [key, roles] of byResAct) {
    const i = key.indexOf('.');
    const res = key.slice(0, i);
    const act = key.slice(i + 1);
    if (!byRes.has(res)) byRes.set(res, {});
    byRes.get(res)[act] = [...roles].sort();
  }

  const same = (a, b) => a && b && a.join() === b.join();
  const out = {};
  for (const [res, acts] of byRes) {
    if (acts.view) out[`${res}.view`] = acts.view;
    const writes = ['create', 'edit', 'delete'].map(a => acts[a]).filter(Boolean);
    // Fold only when they agree AND the result grants somebody something.
    if (writes.length && writes.every(w => same(w, writes[0])) && writes[0].length > 0) {
      out[`${res}.manage`] = writes[0];
    } else {
      for (const a of ['create', 'edit', 'delete']) if (acts[a]) out[`${res}.${a}`] = acts[a];
    }
    // Anything else is a path-suffixed key from the split above
    // (e.g. enrollmentForms.create.id-submit). Carried through verbatim —
    // dropping it would leave its route governed by no permission at all,
    // which is worse than the empty grant the split exists to avoid.
    for (const [a, roles] of Object.entries(acts)) {
      if (!['view', 'create', 'edit', 'delete'].includes(a)) out[`${res}.${a}`] = roles;
    }
  }
  return out;
}

if (import.meta.filename === process.argv[1]) {
  const routes = collectRoutes();
  const keys = buildKeys(routes);
  const body = Object.keys(keys).sort()
    .map(k => `  '${k}': [${keys[k].map(r => `'${r}'`).join(', ')}],`).join('\n');

  let src = fs.readFileSync(OUT, 'utf8');
  src = src.replace(
    /export const FALLBACK_GRANTS: Record<string, readonly string\[\]> = Object\.freeze\(\{[\s\S]*?\n\}\);/,
    `export const FALLBACK_GRANTS: Record<string, readonly string[]> = Object.freeze({\n${body}\n});`,
  );
  fs.writeFileSync(OUT, src);

  const empty = Object.entries(keys).filter(([, r]) => r.length === 0);
  console.log(`guarded routes: ${routes.length} | permission keys: ${Object.keys(keys).length}`);
  if (empty.length) console.log('keys granting nobody:', empty.map(([k]) => k).join(', '));
}
