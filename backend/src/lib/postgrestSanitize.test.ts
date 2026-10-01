import { describe, it, expect } from 'vitest';
import { sanitizeForPostgrestFilter } from './postgrestSanitize';
import { parseOr } from './pgrest/filters';

// The bug: the sanitiser stripped , ( ) but NOT { }, while the shim's
// splitTopLevel increments depth on `{` as well as `(`. One brace in a search
// box left depth stuck above zero, so no comma ever split the OR and all the
// branches collapsed into a single nonsense term that matched nothing — an
// empty result set with no error, which reads as "no such record".
describe('sanitizeForPostgrestFilter', () => {
  it('strips every character the filter DSL treats as structural', () => {
    expect(sanitizeForPostgrestFilter('a,b(c)d{e}f')).toBe('abcdef');
  });

  it('leaves ordinary search text alone', () => {
    for (const term of ['Gayathri', 'EMP-0129', "O'Brien", 'acme corp', 'a-b_c.d']) {
      expect(sanitizeForPostgrestFilter(term)).toBe(term);
    }
  });

  // The regression itself, asserted end to end through the real parser.
  it('keeps a braced search term from collapsing the OR', () => {
    const term = sanitizeForPostgrestFilter('{test');
    const branches = parseOr(
      `display_id.ilike.%${term}%,receipt_number.ilike.%${term}%,description.ilike.%${term}%`,
    );
    // Three independent branches, not one swallowed term.
    expect(branches.parts).toHaveLength(3);
  });

  it('still splits correctly for an unbraced term, unchanged behaviour', () => {
    const term = sanitizeForPostgrestFilter('acme');
    const branches = parseOr(`display_id.ilike.%${term}%,description.ilike.%${term}%`);
    expect(branches.parts).toHaveLength(2);
  });

  it('would have failed before the fix', () => {
    // Proof the old sanitiser was the problem: with braces left in, the parser
    // sees one unterminated group and never splits.
    const oldSanitise = (s: string) => s.replace(/[,()]/g, '');
    const term = oldSanitise('{test');
    expect(term).toBe('{test');
    expect(parseOr(`display_id.ilike.%${term}%,description.ilike.%${term}%`).parts).toHaveLength(1);
  });
});
