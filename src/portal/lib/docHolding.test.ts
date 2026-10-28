import { describe, it, expect } from 'vitest';
import {
  holdingSlotFor, effectiveHolding, hidesUpload, identityDocsForPersist,
  isEmployerManagedRow, type HoldingAnswer,
} from './docHolding';
import {
  IDENTITY_DOC_ROWS, EMPLOYER_DOC_ROWS, getRequiredIdentityTypes, isIdentityRowVisible,
} from './documentTypes';

const VISA_TYPES = ['citizen', 'other', 'gc', 'h1b', 'l1', 'l2', 'tn', 'opt', 'stem_opt', 'h4_ead'];

describe('who gets asked "do you have this?"', () => {
  it('asks about an optional employee-issued document', () => {
    expect(holdingSlotFor({ required: false, employerManaged: false })).toBe('ask');
  });

  it('never asks about a required document', () => {
    expect(holdingSlotFor({ required: true, employerManaged: false })).toBe('required');
  });

  it('never asks about a document the employer issues', () => {
    expect(holdingSlotFor({ required: false, employerManaged: true })).toBe('none');
  });

  it('treats required as the stronger rule', () => {
    expect(holdingSlotFor({ required: true, employerManaged: true })).toBe('required');
  });

  it('recognises the employer-issued rows from the shared table', () => {
    expect(isEmployerManagedRow(EMPLOYER_DOC_ROWS[0].type)).toBe(true);
    expect(isEmployerManagedRow('passport')).toBe(false);
  });
});

/**
 * THE SAFETY PROPERTY.
 *
 * If this ever returns true for a required row, the upload control, the number
 * and the expiry all disappear from a document the company must hold — and the
 * person can finish onboarding without it.
 */
describe('a required row never hides its upload', () => {
  it.each([undefined, 'yes', 'no'] as (HoldingAnswer | undefined)[])(
    'stays visible when the stored answer is %s', answer => {
      expect(hidesUpload('required', answer)).toBe(false);
    });

  it('hides the upload for an optional row answered no', () => {
    expect(hidesUpload('ask', 'no')).toBe(true);
  });

  it('reveals the upload once an optional row is answered yes', () => {
    expect(hidesUpload('ask', 'yes')).toBe(false);
  });

  // The question comes first: an optional row shows the Yes/No and nothing
  // else until it is answered, which is what keeps the section short rather
  // than presenting a dozen upload boxes nobody needs to fill.
  it('holds the upload back until an optional row is answered', () => {
    expect(hidesUpload('ask', undefined)).toBe(true);
  });

  it('never hides an employer row, which has no answer to act on', () => {
    expect(hidesUpload('none', 'no')).toBe(false);
  });
});

describe('the answer shown', () => {
  it('reads a document already on file as yes', () => {
    expect(effectiveHolding(undefined, { slot: 'ask', hasFileOrUpload: true })).toBe('yes');
  });

  it('leaves an untouched row unanswered rather than guessing no', () => {
    expect(effectiveHolding(undefined, { slot: 'ask', hasFileOrUpload: false })).toBeUndefined();
  });

  it('prefers what the person actually said', () => {
    expect(effectiveHolding('no', { slot: 'ask', hasFileOrUpload: false })).toBe('no');
    expect(effectiveHolding('yes', { slot: 'ask', hasFileOrUpload: false })).toBe('yes');
  });

  it('has no answer to report for a required or employer row', () => {
    expect(effectiveHolding('no', { slot: 'required', hasFileOrUpload: false })).toBeUndefined();
    expect(effectiveHolding('no', { slot: 'none', hasFileOrUpload: false })).toBeUndefined();
  });
});

describe('what gets saved', () => {
  const visible = () => true;

  // The defect: the old filter kept only rows with a number, state or expiry,
  // so a bare "no" was dropped and the question came back on every visit.
  it('keeps a row that carries nothing but a no', () => {
    expect(identityDocsForPersist([{ type: 'driver_license', held: 'no' }], [], visible))
      .toEqual([{ type: 'driver_license', held: 'no' }]);
  });

  it('keeps a row that carries nothing but a yes', () => {
    expect(identityDocsForPersist([{ type: 'driver_license', held: 'yes' }], [], visible))
      .toEqual([{ type: 'driver_license', held: 'yes' }]);
  });

  it('still keeps the rows it always kept', () => {
    const rows = [
      { type: 'passport', number: 'X123', state: '', expiry: '2030-01-01' },
      { type: 'state_id', number: '', state: 'TX', expiry: '' },
    ];
    expect(identityDocsForPersist(rows, [], visible)).toEqual(rows);
  });

  it('drops a row that is genuinely empty', () => {
    expect(identityDocsForPersist([{ type: 'other', number: '', state: '', expiry: '' }], [], visible))
      .toEqual([]);
  });

  // Gate safety, persistence half: a required document's answer must not exist.
  it('strips an answer from a required document', () => {
    expect(identityDocsForPersist([{ type: 'passport', held: 'no' }], ['passport'], visible))
      .toEqual([]);
  });

  it('keeps a required row\'s details while dropping its answer', () => {
    expect(identityDocsForPersist(
      [{ type: 'passport', number: 'X1', expiry: '2030-01-01', held: 'no' }], ['passport'], visible,
    )).toEqual([{ type: 'passport', number: 'X1', expiry: '2030-01-01' }]);
  });

  // A visa change must not leave an opt-out on a document that is now hidden,
  // because switching back would resurrect it as an answered question.
  it('strips an answer from a document not shown for this status', () => {
    expect(identityDocsForPersist(
      [{ type: 'i20', held: 'no' }], [], t => t !== 'i20',
    )).toEqual([]);
  });

  it('handles a missing array without throwing', () => {
    expect(identityDocsForPersist(undefined as never, [], visible)).toEqual([]);
  });
});

/**
 * The user's report was "we have only for green card holders". It is not true
 * of the code and never was — but it is the kind of claim that is cheap to pin
 * and expensive to re-investigate, so these counts hold the line.
 */
describe('every work status has optional documents to ask about', () => {
  const askCount = (visa: string) => {
    const required = getRequiredIdentityTypes(visa);
    return IDENTITY_DOC_ROWS
      .filter(r => isIdentityRowVisible(r.type, visa))
      .filter(r => holdingSlotFor({
        required: required.includes(r.type),
        employerManaged: isEmployerManagedRow(r.type),
      }) === 'ask')
      .length;
  };

  it.each([
    ['citizen', 9], ['other', 13], ['gc', 9], ['h1b', 14], ['l1', 10],
    ['l2', 10], ['tn', 10], ['opt', 5], ['stem_opt', 6], ['h4_ead', 7],
  ])('asks on %i optional rows for %s', (visa, expected) => {
    expect(askCount(visa as string)).toBe(expected);
  });

  it('is not a Green Card special case — h1b asks on more rows than gc', () => {
    expect(askCount('h1b')).toBeGreaterThan(askCount('gc'));
  });

  it('asks on at least one row for every work status', () => {
    for (const visa of VISA_TYPES) {
      expect(askCount(visa), visa).toBeGreaterThan(0);
    }
  });

  // Every visible row must offer exactly one of the three treatments, so no
  // row can render with neither a Yes/No nor a "Required" marker.
  it('gives every visible row exactly one treatment', () => {
    for (const visa of VISA_TYPES) {
      const required = getRequiredIdentityTypes(visa);
      for (const row of IDENTITY_DOC_ROWS.filter(r => isIdentityRowVisible(r.type, visa))) {
        const slot = holdingSlotFor({
          required: required.includes(row.type),
          employerManaged: isEmployerManagedRow(row.type),
        });
        expect(['required', 'ask', 'none'], `${row.type} [${visa}]`).toContain(slot);
      }
    }
  });
});
