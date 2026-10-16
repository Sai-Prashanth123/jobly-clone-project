import { describe, it, expect } from 'vitest';
import { requiredFor } from './documentGaps.service';

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
