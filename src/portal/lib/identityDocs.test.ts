import { describe, it, expect } from 'vitest';
import { findIdentityDoc, hasIdentityDocDetail, photoIdOf, photoIdLabel } from './identityDocs';

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
