/**
 * Rewrite requireRole call sites to requirePermission, file by file.
 *
 *   node scripts/swapGuards.mjs clients          # one route file
 *   node scripts/swapGuards.mjs --all            # everything
 *   node scripts/swapGuards.mjs clients --dry    # show, don't write
 *
 * Mechanical on purpose. Each route keeps its old role list as the trailing
 * fallback argument, so the swap cannot change behaviour even if the
 * permission tables are empty — and permissions.parity.test.ts proves that
 * for every route and every role after each file.
 *
 * Only inline guards are rewritten. Aliased guards (const ADMIN_HR = ...) and
 * router.use(requireRole(...)) are left alone and reported: those apply to
 * many routes at once, so turning them into per-route permissions is a
 * judgement call about what the permission should be, not a substitution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectRoutes, buildKeys } from './generatePermissions.mjs';

const DIR = path.join(import.meta.dirname, '..', 'src', 'routes');
const ACTION = { GET: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

const keys = buildKeys(collectRoutes(DIR));

/** The permission key governing a given route, by the same rules as the test. */
function keyFor(file, method, routePath) {
  const res = file.replace(/\.routes\.ts$/, '');
  const act = ACTION[method];
  const slug = routePath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
  for (const c of [`${res}.${act}.${slug}`, `${res}.${act}`, `${res}.manage`]) {
    if (c in keys) return c;
  }
  return null;
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const targets = args.includes('--all')
  ? fs.readdirSync(DIR).filter(f => f.endsWith('.routes.ts'))
  : args.filter(a => !a.startsWith('--')).map(a => (a.endsWith('.routes.ts') ? a : `${a}.routes.ts`));

let swapped = 0, skipped = 0;
for (const file of targets) {
  const full = path.join(DIR, file);
  let src = fs.readFileSync(full, 'utf8');
  const before = src;

  src = src.replace(
    /(router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,\s*)requireRole\(([^)]*)\)/g,
    (whole, head, verb, routePath, roleArgs) => {
      const key = keyFor(file, verb.toUpperCase(), routePath);
      if (!key) { skipped++; return whole; }
      swapped++;
      return `${head}requirePermission('${key}', ${roleArgs.trim()})`;
    },
  );

  if (src === before) continue;

  // Import the new guard beside the old one; requireRole may still be used by
  // an alias or a router.use in the same file.
  if (!/requirePermission/.test(src.split('\n').filter(l => l.startsWith('import')).join('\n'))) {
    src = src.replace(
      /import \{([^}]*)\} from '(\.\.\/middleware\/rbac)'/,
      (_m, names, from) => `import {${names.replace(/\s+$/, '')}, requirePermission } from '${from}'`,
    );
  }

  if (dry) console.log(`[dry] ${file}`);
  else fs.writeFileSync(full, src);
}

console.log(`${dry ? 'would swap' : 'swapped'}: ${swapped} | left alone (no key — aliased or router-wide): ${skipped}`);

/**
 * Second pass: the guards that are not written on the route line.
 *
 *   --aliases   const ADMIN_HR = requireRole('admin','hr'); router.get('/', ADMIN_HR, …)
 *   --wide      router.use(requireRole('admin'));           router.get('/users', …)
 *
 * Kept separate from the inline pass and run deliberately, because both change
 * the SHAPE of a file rather than substituting one call for another: an alias
 * has to be expanded at each use and then removed, and a router-wide guard has
 * to be pushed down onto every route before it can be deleted. Parity is
 * checked after each, which is what makes either safe to do mechanically.
 */
export function swapIndirect(mode, { dry = false } = {}) {
  let changed = 0;
  for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.routes.ts'))) {
    const full = path.join(DIR, file);
    let src = fs.readFileSync(full, 'utf8');
    const before = src;

    if (mode === 'aliases') {
      const aliases = new Map();
      for (const m of src.matchAll(/const\s+(\w+)\s*=\s*requireRole\(([^)]*)\)\s*;?/g)) {
        aliases.set(m[1], m[2].trim());
      }
      if (aliases.size === 0) continue;

      src = src.replace(
        /(router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,\s*)(\w+)(\s*,)/g,
        (whole, head, verb, routePath, name, tail) => {
          if (!aliases.has(name)) return whole;
          const key = keyFor(file, verb.toUpperCase(), routePath);
          if (!key) return whole;
          changed++;
          return `${head}requirePermission('${key}', ${aliases.get(name)})${tail}`;
        },
      );

      // Drop alias declarations nothing uses any more — an unused const is a
      // lint error, and leaving one implies a guard that no longer guards.
      for (const name of aliases.keys()) {
        const uses = (src.match(new RegExp(`(^|[^\w])${name}([^\w]|$)`, 'g')) ?? []).length;
        if (uses <= 1) {
          src = src.replace(new RegExp(`\s*const\s+${name}\s*=\s*requireRole\([^)]*\)\s*;?`), '');
        }
      }
    }

    if (mode === 'wide') {
      const wide = src.match(/router\.use\(\s*requireRole\(([^)]*)\)\s*\)\s*;?/);
      if (!wide) continue;
      const roles = wide[1].trim();

      // Push the guard down onto every route, then remove the router-wide one.
      src = src.replace(
        /(router\.(get|post|put|patch|delete)\(\s*'([^']*)'\s*,\s*)/g,
        (whole, head, verb, routePath) => {
          if (/requirePermission|requireRole/.test(whole)) return whole;
          const key = keyFor(file, verb.toUpperCase(), routePath);
          if (!key) return whole;
          changed++;
          return `${head}requirePermission('${key}', ${roles}), `;
        },
      );
      src = src.replace(/\s*router\.use\(\s*requireRole\([^)]*\)\s*\)\s*;?/, '');
    }

    if (src === before) continue;
    if (!/requirePermission/.test(src.split('\n').filter(l => l.startsWith('import')).join('\n'))) {
      src = src.replace(
        /import \{([^}]*)\} from '(\.\.\/middleware\/rbac)'/,
        (_m, names, from) => `import {${names.replace(/\s+$/, '')}, requirePermission } from '${from}'`,
      );
    }
    if (!dry) fs.writeFileSync(full, src);
  }
  return changed;
}

if (args.includes('--aliases')) console.log('aliased routes swapped:', swapIndirect('aliases', { dry }));
if (args.includes('--wide')) console.log('router-wide routes swapped:', swapIndirect('wide', { dry }));
