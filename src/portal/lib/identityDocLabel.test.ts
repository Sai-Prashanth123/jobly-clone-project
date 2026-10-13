import { describe, it, expect } from 'vitest';
import { identityDocLabel, IDENTITY_DOC_ROWS } from './documentTypes';

/**
 * HR read `i20`, `us_visa`, `i983` and `i94` off an employee's profile.
 *
 * Two pages each kept a hand-written type→label map with a `?? type` fallback,
 * and the two had already drifted — six entries on one, eleven on the other,
 * and the second still carrying the legacy "US Visa" wording. The map is now
 * derived from IDENTITY_DOC_ROWS, which is where these names are authored, so
 * a new row cannot arrive without its label.
 */
describe('identity document labels', () => {
  it('names every row the wizard can write — no raw keys', () => {
    for (const row of IDENTITY_DOC_ROWS) {
      expect(identityDocLabel(row.type), `label for "${row.type}"`).toBe(row.label);
      expect(identityDocLabel(row.type)).not.toBe(row.type);
    }
  });

  // The exact four from the screenshot.
  it('names the ones that were showing as keys', () => {
    expect(identityDocLabel('i20')).toBe('I-20');
    expect(identityDocLabel('us_visa')).toBe('Visa');
    expect(identityDocLabel('i983')).toBe('I-983');
    expect(identityDocLabel('i94')).toBe('I-94');
  });

  // MyProfile's copy said "US Visa" — the legacy wording, which disagreed with
  // every other screen.
  it('uses the current wording, not the legacy alias', () => {
    expect(identityDocLabel('us_visa')).not.toBe('US Visa');
  });

  it('prefers a label stored on the row, for per-visa variants', () => {
    expect(identityDocLabel('ead', 'EAD / OPT Card')).toBe('EAD / OPT Card');
    expect(identityDocLabel('ead', '   ')).toBe('Employment Authorization Document');
  });

  it('falls back visibly for a type no row defines', () => {
    // Better surfaced than swallowed: it means a row was removed from under
    // existing data.
    expect(identityDocLabel('something_removed')).toBe('something_removed');
    expect(identityDocLabel(null)).toBe('Document');
    expect(identityDocLabel(undefined)).toBe('Document');
  });
});
