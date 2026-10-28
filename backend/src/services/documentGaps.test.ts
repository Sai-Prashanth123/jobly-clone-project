import { describe, it, expect } from 'vitest';
import { requiredFor, declinedForCategory } from './documentGaps.service';

/**
 * The requirement union the gap report compares against.
 *
 * Exercised directly rather than through buildDocumentGapsReport, which needs
 * a database. What matters here is that the report measures against the SAME
 * set the onboarding gate enforces — a report built on a different idea of
 * "required" would send people to argue about gaps that are not there.
 */

describe('what the report treats as required', () => {
  it('always includes the four everyone needs', () => {
    for (const visa of ['h1b', 'opt', 'gc', 'citizen', 'l1', 'other']) {
      const r = requiredFor(visa);
      for (const base of ['Resume', 'Social Security Card', 'W-4', 'Insurance Waiver Form']) {
        expect(r, `${base} for ${visa}`).toContain(base);
      }
    }
  });

  it('adds passport, visa and I-94 for work-visa categories only', () => {
    for (const visa of ['h1b', 'l1', 'l2', 'opt', 'stem_opt', 'h4_ead', 'tn']) {
      expect(requiredFor(visa), visa).toContain('Passport');
      expect(requiredFor(visa), visa).toContain('I-94');
    }
    // A green card holder is no longer on the status they entered on, and a
    // citizen never had one.
    for (const visa of ['gc', 'citizen']) {
      expect(requiredFor(visa), visa).not.toContain('I-94');
    }
  });

  it('adds the per-category extras', () => {
    expect(requiredFor('h1b')).toContain('I-797');
    expect(requiredFor('opt')).toContain('I-20');
    expect(requiredFor('opt')).toContain('Employment Authorization Document');
    expect(requiredFor('gc')).toContain('Labor Certificate (PERM)');
  });

  // The five categories with nothing of their own — the clearest candidates
  // for the conversation this report exists to inform.
  it('shows that five categories have no documents of their own', () => {
    const bare = ['l1', 'l2', 'tn', 'citizen', 'other'].filter(v => {
      const base = requiredFor('citizen');            // the four universals
      return requiredFor(v).every(d => base.includes(d) || ['Passport', 'Visa', 'I-94'].includes(d));
    });
    expect(bare).toEqual(['l1', 'l2', 'tn', 'citizen', 'other']);
  });

  it('never returns a duplicate', () => {
    for (const visa of ['h1b', 'opt', 'stem_opt', 'gc', 'h4_ead']) {
      const r = requiredFor(visa);
      expect(new Set(r).size, visa).toBe(r.length);
    }
  });

  it('answers for an unknown category without throwing', () => {
    expect(requiredFor('not_a_real_status')).toEqual(
      expect.arrayContaining(['Resume', 'W-4']),
    );
  });
});

/**
 * The "declared not held" section.
 *
 * The Yes/No opt-out was collecting answers nobody could see. A document a
 * whole category keeps declining is the clearest possible signal that the
 * category should not be asking for it — the inverse of a candidate gap.
 */
describe('counting the documents a category declines', () => {
  const emp = (...docs: unknown[]) => ({ identity_documents: docs });

  it('counts a no per document', () => {
    const rows = declinedForCategory('h1b', [
      emp({ type: 'driver_license', held: 'no' }),
      emp({ type: 'driver_license', held: 'no' }),
      emp({ type: 'state_id', held: 'no' }),
    ], new Set());
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentType: "Driver's License", declaredNo: 2, categorySize: 3, percent: 67 }),
      expect.objectContaining({ documentType: 'State-Issued ID', declaredNo: 1, percent: 33 }),
    ]));
  });

  it('ignores a yes and an unanswered row', () => {
    const rows = declinedForCategory('h1b', [
      emp({ type: 'driver_license', held: 'yes' }),
      emp({ type: 'state_id' }),
      emp({ type: 'passport', number: 'X1' }),
    ], new Set());
    expect(rows).toEqual([]);
  });

  // The invariant made observable: a "no" on a required document is being
  // ignored by the gate, and the report says so rather than hiding it.
  it('flags a no on a document the category requires', () => {
    const rows = declinedForCategory('h1b', [emp({ type: 'passport', held: 'no' })], new Set(['Passport']));
    expect(rows).toHaveLength(1);
    expect(rows[0].conflictsWithRequirement).toBe(true);
  });

  it('does not flag a no on an optional document', () => {
    const rows = declinedForCategory('h1b', [emp({ type: 'driver_license', held: 'no' })], new Set(['Passport']));
    expect(rows[0].conflictsWithRequirement).toBe(false);
  });

  // A production row holds an object rather than an array here; iterating it
  // took a page down once.
  it('survives identity_documents being an object rather than an array', () => {
    expect(() => declinedForCategory('h1b', [
      { identity_documents: { type: 'passport', held: 'no' } },
      { identity_documents: null },
      {},
    ], new Set())).not.toThrow();
    expect(declinedForCategory('h1b', [{ identity_documents: {} }], new Set())).toEqual([]);
  });

  it('ignores junk inside the array', () => {
    expect(declinedForCategory('h1b', [
      emp(null, 'nonsense', 42, { held: 'no' }, { type: 7, held: 'no' }),
    ], new Set())).toEqual([]);
  });

  it('reports nothing for an empty category rather than dividing by zero', () => {
    expect(declinedForCategory('h1b', [], new Set())).toEqual([]);
  });
});
