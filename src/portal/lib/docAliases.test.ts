import { describe, it, expect } from 'vitest';
import { LEGACY_LABEL_ALIASES, IDENTITY_DOC_ROWS, docMatchesRow } from './documentTypes';

/**
 * Spellings the same document has actually been filed under in production.
 *
 * `documents.type` is free text — the "Other" box sends whatever is typed and
 * the server stores it unvalidated — so one document collects names. A name
 * missing from the alias map is INVISIBLE to the matcher: the employee is
 * asked to upload something they already uploaded, and the onboarding gate
 * counts it missing.
 *
 * These nine were found by auditing the 42 distinct labels live. Between them
 * they made one OPT employee appear to be missing three documents they had
 * provided. Pinned here so a tidy-up cannot quietly drop one and reopen it.
 */
const SEEN_IN_PRODUCTION: Array<[string, string]> = [
  ['Social Security Card', 'SSN'],
  ['Social Security Card', 'SN copy'],
  ['Social Security Card', 'Social Security'],
  ['Social Security Card', 'Social Security Number'],
  ['Employment Authorization Document', 'EAD'],
  ['Employment Authorization Document', 'EAD Copy'],
  ['I-20', 'I-20 copy'],
  ['I-983', 'I-983 Form'],
  ['Resume', 'Latest Resume'],
  ['Visa', 'Visa copy'],
  ['Visa', 'US Visa'],
];

const rowFor = (label: string) => IDENTITY_DOC_ROWS.find(r => r.label === label)!;

describe('document spellings seen in production', () => {
  it.each(SEEN_IN_PRODUCTION)('%s is satisfied by a document filed as "%s"', (canonical, variant) => {
    const row = rowFor(canonical);
    expect(row, `no row labelled "${canonical}"`).toBeTruthy();
    expect(docMatchesRow({ type: variant }, row)).toBe(true);
  });

  it('still matches the canonical label itself', () => {
    for (const [canonical] of SEEN_IN_PRODUCTION) {
      expect(docMatchesRow({ type: canonical }, rowFor(canonical)), canonical).toBe(true);
    }
  });

  // An alias is a claim that two names mean one document. Pointing one at a
  // label no row has would silently never match.
  it('every alias key is a real row label', () => {
    const labels = new Set(IDENTITY_DOC_ROWS.map(r => r.label));
    const orphans = Object.keys(LEGACY_LABEL_ALIASES).filter(k => !labels.has(k));
    expect(orphans).toEqual([]);
  });

  // Two rows claiming the same alias would make the match order decide which
  // document someone had uploaded.
  it('no spelling is claimed by two different documents', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [canonical, variants] of Object.entries(LEGACY_LABEL_ALIASES)) {
      for (const v of variants) {
        if (owner.has(v)) clashes.push(`"${v}" claimed by both ${owner.get(v)} and ${canonical}`);
        owner.set(v, canonical);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('does not match an unrelated document', () => {
    expect(docMatchesRow({ type: 'Passport' }, rowFor('Resume'))).toBe(false);
    expect(docMatchesRow({ type: undefined }, rowFor('Resume'))).toBe(false);
  });
});
