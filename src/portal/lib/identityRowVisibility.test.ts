import { describe, it, expect } from 'vitest';
import { IDENTITY_DOC_ROWS, ROW_VISA_GATE, ROW_VISA_EXCLUDE } from './documentTypes';

/**
 * Which identity rows an employee is shown, per visa type.
 *
 * The filter lives inline in NewEmployee.tsx, so this mirrors its rules rather
 * than importing them. That mirroring is the point: the duplicate STEM OPT
 * card survived a removal because an EARLIER branch in that filter returned
 * true for OPT and STEM OPT before the removal was ever reached — the fix was
 * dead code for precisely the two visa types that could see the problem, and
 * nothing failed. Ordering is the thing under test.
 */
const NEVER_SHOWN = new Set(['opt_card', 'stem_opt_card']);
const OPT_ONLY = new Set(['i983', 'i20']);

function isShown(rowType: string, visaType: string): boolean {
  // 1. Absolute: the OPT/STEM OPT cards ARE the EAD, never their own row.
  if (NEVER_SHOWN.has(rowType)) return false;
  // 2. F-1 specific.
  if (OPT_ONLY.has(rowType)) return visaType === 'opt' || visaType === 'stem_opt';
  // 3. Explicit excludes beat the allow-list.
  if ((ROW_VISA_EXCLUDE[rowType] ?? []).includes(visaType)) return false;
  // 4. Allow-list, where one exists.
  const gate = ROW_VISA_GATE[rowType];
  return gate ? gate.includes(visaType) : true;
}

describe('the OPT and STEM OPT card rows are never shown', () => {
  // The reported case. Previously true, because rule 2 ran first.
  it('is hidden for STEM OPT — the case that was reported', () => {
    expect(isShown('stem_opt_card', 'stem_opt')).toBe(false);
  });

  it('is hidden for OPT', () => {
    expect(isShown('opt_card', 'opt')).toBe(false);
    expect(isShown('stem_opt_card', 'opt')).toBe(false);
  });

  it('is hidden for every other visa type too', () => {
    for (const visa of ['h1b', 'l1', 'l2', 'gc', 'citizen', 'tn', 'h4_ead', 'other']) {
      expect(isShown('opt_card', visa), `opt_card for ${visa}`).toBe(false);
      expect(isShown('stem_opt_card', visa), `stem_opt_card for ${visa}`).toBe(false);
    }
  });

  // The EAD is what replaces them, so it must still be there.
  it('still shows the EAD row, which carries the merged label', () => {
    expect(isShown('ead', 'opt')).toBe(true);
    expect(isShown('ead', 'stem_opt')).toBe(true);
  });
});

describe('green card and citizen are not asked for entry documents', () => {
  it('hides the visa stamp, I-94 and I-797', () => {
    for (const visa of ['gc', 'citizen']) {
      for (const row of ['us_visa', 'i94', 'i797']) {
        expect(isShown(row, visa), `${row} for ${visa}`).toBe(false);
      }
    }
  });

  it('hides the I-140 petition trail for a green card holder', () => {
    expect(isShown('i140', 'gc')).toBe(false);
    expect(isShown('i140_approval_notice', 'gc')).toBe(false);
  });

  it('still shows them where the petition is live — H-1B', () => {
    expect(isShown('i140', 'h1b')).toBe(true);
    expect(isShown('us_visa', 'h1b')).toBe(true);
    expect(isShown('i94', 'h1b')).toBe(true);
  });

  it('still asks a green card holder for the card-adjacent paperwork', () => {
    expect(isShown('labor_certificate', 'gc')).toBe(true);
    expect(isShown('education_documents', 'gc')).toBe(true);
    expect(isShown('passport', 'gc')).toBe(true);
  });
});

describe('every row resolves for every visa type', () => {
  // A row that throws or returns undefined would vanish silently.
  it('returns a boolean for each row and visa combination', () => {
    for (const row of IDENTITY_DOC_ROWS) {
      for (const visa of ['opt', 'stem_opt', 'h1b', 'gc', 'citizen', 'l1', 'l2', 'tn', 'h4_ead', 'other']) {
        expect(typeof isShown(row.type, visa), `${row.type} / ${visa}`).toBe('boolean');
      }
    }
  });
});
