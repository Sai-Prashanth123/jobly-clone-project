import { describe, it, expect } from 'vitest';
import {
  seesWholeFile, visibleIdentityDocs, visibleDocuments,
  isPmVisibleIdentityType, isPmVisibleDocLabel,
} from './docVisibility';

/**
 * "Still seeing all the documents from the project manager's view — I have
 * told these documents should be visible by project manager."
 *
 * The list HR named was right; the DIRECTION was wrong. It read as "only a
 * manager may see these", which hid them from HR (who then reported losing
 * the DL details) while the PM still saw the whole file, resumes and W-4s
 * included. A PM now sees the named documents and nothing else; admin and HR
 * see everything, as they always did.
 */

const IDENTITY = [
  { type: 'i9_form' }, { type: 'i94' }, { type: 'lca' }, { type: 'us_visa' },
  { type: 'driver_license' }, { type: 'education_documents' }, { type: 'passport' },
  { type: 'ssn' }, { type: 'w4' }, { type: 'offer_letter' }, { type: 'resume' },
];

const UPLOADED = [
  { type: 'I-9 Form' }, { type: 'Visa' }, { type: "Driver's License" },
  { type: 'E-Verify Letter' }, { type: 'Passport' },
  { type: 'Resume' }, { type: 'W-4' }, { type: 'Offer Letter' },
  { type: 'Social Security Card' }, { type: 'Bank Letter' },
];

describe('a Project Manager sees only the named documents', () => {
  it('does not see the whole file', () => {
    expect(seesWholeFile('operations')).toBe(false);
  });

  // The reported case: resumes, W-4s, offer letters, SSN card, bank letters.
  it('is not shown personnel paperwork', () => {
    const shown = visibleDocuments(UPLOADED, 'operations').map(d => d.type);
    for (const hidden of ['Resume', 'W-4', 'Offer Letter', 'Social Security Card', 'Bank Letter']) {
      expect(shown, hidden).not.toContain(hidden);
    }
  });

  it('is shown the work-authorisation documents it exists to verify', () => {
    const shown = visibleDocuments(UPLOADED, 'operations').map(d => d.type);
    for (const seen of ['I-9 Form', 'Visa', "Driver's License", 'E-Verify Letter']) {
      expect(shown, seen).toContain(seen);
    }
  });

  it('applies the same rule to the identity rows', () => {
    const shown = visibleIdentityDocs(IDENTITY, 'operations').map(d => d.type);
    expect(shown).toContain('i9_form');
    expect(shown).toContain('driver_license');
    expect(shown).not.toContain('w4');
    expect(shown).not.toContain('offer_letter');
    expect(shown).not.toContain('resume');
  });

  // A PM cannot check work authorisation without the identity it rests on.
  it('keeps the passport, a List A identity document', () => {
    expect(isPmVisibleIdentityType('passport')).toBe(true);
    expect(isPmVisibleDocLabel('Passport')).toBe(true);
  });
});

describe('admin and HR see the whole file', () => {
  // This is the regression that was reported live: HR losing the DL.
  it('HR keeps every document, the driver licence included', () => {
    expect(seesWholeFile('hr')).toBe(true);
    expect(visibleDocuments(UPLOADED, 'hr')).toHaveLength(UPLOADED.length);
    expect(visibleIdentityDocs(IDENTITY, 'hr').map(d => d.type)).toContain('driver_license');
  });

  it('admin keeps every document', () => {
    expect(visibleDocuments(UPLOADED, 'admin')).toHaveLength(UPLOADED.length);
    expect(visibleIdentityDocs(IDENTITY, 'admin')).toHaveLength(IDENTITY.length);
  });

  // An unknown or missing role must not accidentally become the limited one.
  it('defaults to the whole file rather than to nothing', () => {
    expect(seesWholeFile(undefined)).toBe(true);
    expect(seesWholeFile(null)).toBe(true);
    expect(visibleDocuments(UPLOADED, undefined)).toHaveLength(UPLOADED.length);
  });
});

describe('the lists themselves', () => {
  it('never hides a document it has no opinion about', () => {
    expect(isPmVisibleDocLabel('Something Entirely New')).toBe(false);
    // ...but only the PM is filtered, so a new type still reaches HR.
    expect(visibleDocuments([{ type: 'Something Entirely New' }], 'hr')).toHaveLength(1);
  });

  it('handles an empty list and a missing type', () => {
    expect(visibleDocuments([], 'operations')).toEqual([]);
    expect(visibleDocuments([{}], 'operations')).toEqual([]);
  });
});
