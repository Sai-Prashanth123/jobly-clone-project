import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The onboarding wizard must decide "required" and "shown" from the LIVE
 * document policy, not from the compiled-in tables.
 *
 * This test exists because the bug it guards survived its own fix. In October
 * three call sites in employees.service.ts were reading the compiled-in
 * catalogue while the gate read the live one, so an HR change on the Document
 * Policy page moved the gate and not the screens. That was fixed, and
 * onboardingPolicySources.test.ts was written to stop it recurring — but it
 * scans only employees.service.ts, and the same bug was still sitting in
 * NewEmployee.tsx.
 *
 * The visible symptom: PERM was set to Optional for Green Card, the server
 * agreed, and the wizard carried on rendering "Required — must be uploaded"
 * with no Yes/No. The API was checked; the screen was not.
 *
 * Scanning source text rather than asserting behaviour because the failure is a
 * call site reaching for the wrong helper. There is no return value to inspect,
 * and a newly added call would reintroduce it silently.
 */

// Lives in the backend tree because that is where node types are available —
// the frontend tsconfig has none. contracts.test.ts already reaches across the
// same way, in the other direction.
const SOURCE = readFileSync(
  join(__dirname, '..', '..', '..', 'src', 'portal', 'pages', 'NewEmployee.tsx'),
  'utf8',
);

/** Source lines that call `fn(`, minus comments. */
function callLines(src: string, fn: string): Array<{ line: number; text: string }> {
  return src
    .split('\n')
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(l => l.text.includes(`${fn}(`))
    .filter(l => !l.text.startsWith('//') && !l.text.startsWith('*'));
}

describe('the wizard reads the live document policy', () => {
  it('still calls the policy hook', () => {
    // Anti-vacuous: if the hook goes, every assertion below passes trivially.
    expect(SOURCE).toContain('useDocumentPolicy()');
  });

  it('builds one resolver from it', () => {
    expect(SOURCE).toMatch(/const docPolicy = useMemo/);
    // The resolver must expose all three answers, or a caller will reach past it.
    for (const member of ['stateOf', 'requiredTypes', 'isRequired', 'isVisible']) {
      expect(SOURCE, `docPolicy.${member} missing`).toContain(member);
    }
  });

  /**
   * getRequiredIdentityTypes and isIdentityRowVisible are the compiled-in
   * tables. They are legitimate ONLY inside the resolver's fallback — anywhere
   * else means a screen is answering from code while the gate answers from the
   * database.
   */
  it('confines the compiled-in tables to the fallback', () => {
    const fallbackStart = SOURCE.indexOf('const docPolicy = useMemo');
    const fallbackEnd = SOURCE.indexOf('// Per-section completion', fallbackStart);
    expect(fallbackStart, 'resolver not found').toBeGreaterThan(-1);
    expect(fallbackEnd, 'end of resolver not found').toBeGreaterThan(fallbackStart);

    const offenders: string[] = [];
    for (const fn of ['getRequiredIdentityTypes', 'isIdentityRowVisible']) {
      for (const call of callLines(SOURCE, fn)) {
        const at = SOURCE.indexOf(call.text);
        const insideFallback = at > fallbackStart && at < fallbackEnd;
        // The import line is not a call site.
        const isImport = call.text.startsWith('import') || /^\s*\w+,$/.test(call.text);
        if (!insideFallback && !isImport) offenders.push(`${fn} at line ${call.line}: ${call.text}`);
      }
    }
    expect(offenders, `compiled-in policy used outside the fallback:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  /**
   * The save path strips a "held" answer from any row it believes is required.
   * If it believes that from the compiled-in table, a document HR has just made
   * optional would have the employee's "No" silently discarded on save — the
   * same class of data loss the answer was added to fix.
   */
  it('filters the saved answers through the resolver', () => {
    const persist = SOURCE.slice(SOURCE.indexOf('identityDocsForPersist('));
    const args = persist.slice(0, persist.indexOf('),') + 2);
    expect(args).toContain('docPolicy');
    expect(args).not.toContain('getRequiredIdentityTypes');
  });
});
