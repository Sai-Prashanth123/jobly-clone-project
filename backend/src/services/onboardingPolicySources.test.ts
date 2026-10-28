import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every path that reports onboarding progress must read the LIVE policy.
 *
 * computeOnboarding takes the per-visa requirements as optional arguments and
 * falls back to its compiled-in catalogue when they are missing. That fallback
 * is deliberate — it keeps a fresh or unreachable database working — but it
 * made a silent two-sources-of-truth bug possible, and the bug happened:
 *
 *   The "Finish onboarding" gate passed the live policy. The employee LIST,
 *   the employee DETAIL and the response after a submit did not. So when HR
 *   set PERM to optional for Green Card on the Document Policy page, the gate
 *   stopped demanding it while every screen carried on showing it as a hard
 *   requirement. The page exists precisely so a policy change does not need a
 *   developer; half of it not taking effect is worse than it not existing.
 *
 * Scanning the source rather than asserting behaviour because the failure is a
 * MISSING ARGUMENT at a call site — there is no return value to inspect, and a
 * new call site added later would reintroduce it without any test noticing.
 */

const SOURCE = readFileSync(
  join(__dirname, 'employees.service.ts'),
  'utf8',
);

/** Every computeOnboarding(...) call in the service, with its argument text. */
function callsInSource(src: string): string[] {
  const calls: string[] = [];
  const needle = 'computeOnboarding(';
  let i = src.indexOf(needle);
  while (i !== -1) {
    // Walk to the matching close paren so nested calls are captured whole.
    let depth = 0;
    let j = i + needle.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    calls.push(src.slice(i + needle.length, j));
    i = src.indexOf(needle, j);
  }
  return calls;
}

describe('every onboarding computation reads the live document policy', () => {
  const calls = callsInSource(SOURCE);

  it('finds the call sites at all', () => {
    // If this drops to zero the scan has stopped working and the assertions
    // below would pass vacuously.
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('passes the per-visa requirements to every call', () => {
    const bare = calls.filter(args => !/policy|extras|Extras/.test(args));
    expect(bare, `computeOnboarding called without the live policy:\n${bare.join('\n---\n')}`)
      .toEqual([]);
  });

  it('passes the optional-document list to every call', () => {
    // The optional list is what makes "do you have this?" mandatory; without
    // it a screen shows no questions while the gate demands answers.
    const bare = calls.filter(args => !/optional|Optional/.test(args));
    expect(bare, `computeOnboarding called without the optional documents:\n${bare.join('\n---\n')}`)
      .toEqual([]);
  });
});
