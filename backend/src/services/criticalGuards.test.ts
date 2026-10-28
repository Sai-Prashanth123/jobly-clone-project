import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Four reads that must never fail open.
 *
 * `const { data } = await supabaseAdmin...` discards the error, so a network
 * failure, a permission denial or a malformed filter returns `undefined` —
 * which the caller cannot tell apart from "no rows matched". For most reads
 * that is merely wrong. For these four it is dangerous, because each one is a
 * guard whose "no rows" answer means *proceed*:
 *
 *   invoices.generateInvoice      no rows → nothing is already invoiced → bill it again
 *   payments.reconcileInvoice     no rows → nothing has been paid → zero a paid invoice
 *   notifications expiry sweep    no rows → nothing sent recently → re-email everyone
 *   employees duplicate-email     no rows → the address is free → two people share it
 *
 * There were 25 such destructures in employees.service.ts alone, so this does
 * not try to outlaw the pattern. It pins the four where failing open costs
 * money or identity.
 *
 * Source-scanned rather than behaviour-tested because the failure is a missing
 * binding at a call site; there is no return value to inspect, and mocking the
 * query-builder chain would test the mock.
 */

const read = (...parts: string[]) => readFileSync(join(__dirname, ...parts), 'utf8');

/** The body of `fn`, from its declaration to the next top-level declaration. */
function bodyOf(src: string, fn: string): string {
  const start = src.indexOf(fn);
  if (start === -1) return '';
  const rest = src.slice(start + fn.length);
  const end = rest.search(/\nexport (async )?function |\nasync function |\nfunction /);
  return rest.slice(0, end === -1 ? rest.length : end);
}

interface Guard {
  file: string;
  fn: string;
  /** A fragment unique to the read being guarded. */
  read: string;
  what: string;
}

const GUARDS: Guard[] = [
  {
    file: 'invoices.service.ts', fn: 'export async function generateInvoice',
    read: 'alreadyInvoiced', what: 'the only duplicate-billing check',
  },
  {
    file: 'payments.service.ts', fn: 'async function reconcileInvoice',
    read: 'pays', what: 'the payments total an invoice status is derived from',
  },
  {
    file: 'notifications.service.ts', fn: 'export async function triggerDocumentExpiryAlerts',
    read: 'priorAlerts', what: 'the duplicate-suppression lookback',
  },
  {
    file: 'employees.service.ts', fn: 'export async function createEmployee',
    read: 'existingEmp', what: 'the duplicate-email check on create',
  },
  {
    file: 'employees.service.ts', fn: 'export async function updateEmployee',
    read: 'dup', what: 'the duplicate-email check on update',
  },
];

describe('guards that must not fail open', () => {
  it.each(GUARDS)('$file $fn captures the error on $what', ({ file, fn, read: name }) => {
    const body = bodyOf(read(file), fn);
    expect(body, `${fn} not found in ${file}`).not.toBe('');
    expect(body, `${name} read not found`).toContain(name);

    // The binding must exist...
    const captured = new RegExp(`data:\\s*${name}\\s*,\\s*error:`).test(body)
      || new RegExp(`error:\\s*${name}Error`).test(body);
    expect(captured, `${file} ${fn}: the ${name} read discards its error`).toBe(true);

    // ...and be acted on, not merely bound.
    const acted = new RegExp(`${name}Error`).test(body)
      && /throw |return /.test(body.slice(body.indexOf(`${name}Error`)));
    expect(acted, `${file} ${fn}: ${name}Error is captured but never checked`).toBe(true);
  });

  // Anti-vacuous: if bodyOf stops finding functions every assertion above
  // passes on an empty string.
  it('actually locates every function it claims to check', () => {
    for (const g of GUARDS) {
      expect(bodyOf(read(g.file), g.fn).length, `${g.file} ${g.fn}`).toBeGreaterThan(200);
    }
  });
});
