import { describe, it, expect } from 'vitest';
import {
  IDENTITY_DOC_ROWS, EMPLOYER_DOC_ROWS,
  identityRowFor, rowCollectsNumber,
} from './documentTypes';

/**
 * Which documents actually have a number.
 *
 * HR reported I-20 and I-983 showing "—" on the employee record, reading it as
 * the employee having failed to supply a number. Neither document has one:
 * the onboarding wizard renders no Document Number field for them. The record
 * rendered the line unconditionally, so "no such field" and "left blank" were
 * indistinguishable.
 *
 * `rowCollectsNumber` is now the single answer used by both the wizard and the
 * read surfaces. If they ever disagree again, a row shows a dash for a field
 * nobody can fill, or hides a number somebody typed.
 */

describe('documents that carry no number', () => {
  // The reported case, plus the one nobody had hit yet.
  it.each(['i20', 'i983', 'i797'])('%s has no number field', type => {
    expect(rowCollectsNumber(type)).toBe(false);
  });

  it('is true of most rows — only a handful carry numbers', () => {
    const withNumbers = IDENTITY_DOC_ROWS.filter(r => rowCollectsNumber(r.type));
    expect(withNumbers.map(r => r.type).sort()).toEqual([
      'driver_license', 'ead', 'green_card', 'i94', 'opt_card',
      'passport', 'state_id', 'stem_opt_card', 'us_visa',
    ]);
  });

  // SSN has placeholder text but its number is collected once in the
  // Immigration section, not on the document card. The exclusion lives in
  // rowCollectsNumber so the wizard and the record cannot disagree about it.
  it('excludes SSN even though it has a placeholder', () => {
    expect(identityRowFor('ssn')?.placeholder).toBeTruthy();
    expect(rowCollectsNumber('ssn')).toBe(false);
  });

  // An employee cannot type a number onto a document the company issues.
  it('never claims an employer-issued document has a number', () => {
    for (const row of EMPLOYER_DOC_ROWS) {
      expect(rowCollectsNumber(row.type), row.type).toBe(false);
    }
  });

  it('says no for a document type it has never heard of', () => {
    expect(rowCollectsNumber('invented_document')).toBe(false);
    expect(identityRowFor('invented_document')).toBeUndefined();
  });
});

describe('the row resolver', () => {
  it('finds every employee and employer row by type', () => {
    for (const row of [...IDENTITY_DOC_ROWS, ...EMPLOYER_DOC_ROWS]) {
      expect(identityRowFor(row.type)?.label, row.type).toBe(row.label);
    }
  });

  // The guarantee the read surfaces depend on: a row with a placeholder has an
  // input in the wizard, a row with '' does not.
  it('agrees with the placeholder that drives the wizard input', () => {
    for (const row of IDENTITY_DOC_ROWS) {
      if (row.type === 'ssn') continue;
      expect(rowCollectsNumber(row.type), row.type).toBe(!!row.placeholder);
    }
  });
});
