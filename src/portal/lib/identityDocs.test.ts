import { describe, it, expect } from 'vitest';
import { findIdentityDoc, hasIdentityDocDetail, isIdentityRowListed, photoIdOf, photoIdLabel } from './identityDocs';

// The wizard writes a row for every field it renders, so the array is full of
// `{ type, number: '', expiry: '' }` placeholders. Treating those as present is
// what made the Immigration tile and the Identity & Documents card disagree
// about whether someone had a passport.
describe('identity document lookups', () => {
  it('ignores a placeholder row with nothing in it', () => {
    expect(hasIdentityDocDetail({ type: 'passport' })).toBe(false);
    expect(hasIdentityDocDetail({ type: 'passport', number: '', expiry: '' })).toBe(false);
    expect(findIdentityDoc([{ type: 'passport', number: '  ' }], 'passport')).toBeUndefined();
  });

  // The original complaint: a passport whose expiry was recorded but whose
  // number was not never appeared anywhere on the employee's page, because the
  // only card that showed it filtered on `number` alone.
  it('finds a document that has an expiry but no number', () => {
    const docs = [{ type: 'passport', expiry: '2030-04-01' }];
    expect(hasIdentityDocDetail(docs[0])).toBe(true);
    expect(findIdentityDoc(docs, 'passport')?.expiry).toBe('2030-04-01');
  });

  it('finds a document that has a number but no expiry', () => {
    expect(findIdentityDoc([{ type: 'passport', number: 'Z1234567' }], 'passport')?.number).toBe('Z1234567');
  });

  it('does not confuse one document type for another', () => {
    const docs = [{ type: 'green_card', number: 'A12345678' }];
    expect(findIdentityDoc(docs, 'passport')).toBeUndefined();
  });

  it('survives a missing array', () => {
    expect(findIdentityDoc(undefined, 'passport')).toBeUndefined();
    expect(photoIdOf(undefined)).toBeUndefined();
  });
});

// Driver's licence and state ID are alternatives to each other (I-9 List B),
// so showing both means showing one empty field next to a filled one.
describe('photo ID selection', () => {
  it('prefers the driver licence when both are on file', () => {
    const docs = [
      { type: 'state_id', number: 'S999' },
      { type: 'driver_license', number: 'D111', state: 'TX' },
    ];
    expect(photoIdOf(docs)?.number).toBe('D111');
    expect(photoIdLabel(photoIdOf(docs))).toBe("Driver's License");
  });

  it('falls back to the state ID for a non-driver', () => {
    const docs = [{ type: 'driver_license', number: '' }, { type: 'state_id', number: 'S999', state: 'NJ' }];
    expect(photoIdOf(docs)?.number).toBe('S999');
    expect(photoIdLabel(photoIdOf(docs))).toBe('State-Issued ID');
  });

  it('labels nothing as a driver licence by default rather than crashing', () => {
    expect(photoIdLabel(undefined)).toBe("Driver's License");
  });
});

/**
 * A row that carries only "held: no" — the answer to "do you have this?".
 *
 * It belongs on the Identity & Documents LIST, where the answer is the point,
 * and nowhere near the passport / photo-ID / Immigration tiles, which show a
 * document's details. Widening hasIdentityDocDetail to cover it would have
 * made those tiles render a panel with a dash in every field, which is the
 * exact bug the first test in this file was written to stop.
 */
describe('a document the person says they do not have', () => {
  const declined = { type: 'driver_license' as const, held: 'no' as const };

  it('is not treated as having details', () => {
    expect(hasIdentityDocDetail(declined)).toBe(false);
  });

  it('is still worth listing', () => {
    expect(isIdentityRowListed(declined)).toBe(true);
  });

  it('is invisible to the tile lookups', () => {
    expect(findIdentityDoc([{ type: 'passport', held: 'no' }], 'passport')).toBeUndefined();
    expect(photoIdOf([declined])).toBeUndefined();
  });

  // A bare "yes" means "I have one" — the details and the file are what prove
  // it, so there is nothing to put on a card yet.
  it('does not list a bare yes with nothing behind it', () => {
    expect(isIdentityRowListed({ type: 'driver_license', held: 'yes' })).toBe(false);
  });

  it('still lists a row with real details', () => {
    expect(isIdentityRowListed({ type: 'passport', number: 'X1' })).toBe(true);
    expect(isIdentityRowListed({ type: 'passport', expiry: '2030-01-01' })).toBe(true);
  });
});
