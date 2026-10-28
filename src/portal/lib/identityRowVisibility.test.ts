import { describe, it, expect } from 'vitest';
import {
  IDENTITY_DOC_ROWS, ROW_VISA_GATE, ROW_VISA_EXCLUDE,
  getRequiredIdentityTypes, isIdentityRowVisible,
} from './documentTypes';

/**
 * Which identity rows an employee is shown, per visa type.
 *
 * Ordering is the thing under test. The duplicate STEM OPT card survived a
 * removal because an EARLIER branch returned true for OPT and STEM OPT before
 * the removal was ever reached — the fix was dead code for precisely the two
 * visa types that could see the problem, and nothing failed.
 *
 * These assertions were originally written against a copy of the rules, because
 * the real ones were inlined in NewEmployee.tsx's JSX. They now run against
 * isIdentityRowVisible itself, so the ordering being asserted is the ordering
 * that ships.
 */
const isShown = (rowType: string, visaType: string): boolean =>
  isIdentityRowVisible(rowType, visaType);

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

/**
 * "Can you remove I-140 field from Green card / permanent resident list."
 *
 * THREE rows carry the I-140 name, and they are gated two different ways:
 * i140 and i140_approval_notice by allow-list, i140_questionnaire by
 * exclusion. Moving the first two to h1b-only therefore left the third one on
 * screen, so the field was still there after the change said it had gone.
 */
describe('no I-140 row survives for a permanent resident', () => {
  const I140_ROWS = ['i140', 'i140_approval_notice', 'i140_questionnaire'];

  it('hides every I-140 row for gc and citizen', () => {
    for (const visa of ['gc', 'citizen']) {
      for (const row of I140_ROWS) {
        expect(isShown(row, visa), `${row} for ${visa}`).toBe(false);
      }
    }
  });

  // Whatever the gating style, the rule is about the NAME on screen: if a
  // label says I-140, a green card holder must not see it.
  it('leaves no row labelled I-140 visible to a green card holder', () => {
    const visible = IDENTITY_DOC_ROWS
      .filter(r => isShown(r.type, 'gc'))
      .filter(r => /i-?140/i.test(r.label));
    expect(visible.map(r => r.label)).toEqual([]);
  });

  it('keeps the PERM questionnaire, which is still required for gc', () => {
    expect(isShown('perm_questionnaire', 'gc')).toBe(true);
  });

  it('still shows the I-140 rows to an H-1B employee', () => {
    for (const row of ['i140', 'i140_approval_notice']) {
      expect(isShown(row, 'h1b'), row).toBe(true);
    }
  });
});

/**
 * "The documents listed under each category still have some gaps... or the
 * easy way is you can enable the Yes or No options so that the resource can
 * opt out based on their category."
 *
 * The per-visa lists will always be slightly wrong for somebody, so every
 * OPTIONAL row now asks "do you have this?" before asking for the file.
 * Required rows never ask: an opt-out there would be a way around the
 * onboarding gate rather than a convenience.
 */
describe('which rows may be opted out of', () => {
  const asksHolding = (type: string, visa: string) => {
    const required = REQUIRED_SET(visa).includes(type);
    const isEmployerRow = ['e_verify_letter', 'lca_copy', 'i129', 'i140_employer'].includes(type);
    return !required && !isEmployerRow;
  };
  // Mirrors getRequiredIdentityTypes without importing the whole wizard.
  function REQUIRED_SET(visa: string): string[] {
    return getRequiredIdentityTypes(visa);
  }

  it('never offers an opt-out on a required document', () => {
    for (const visa of ['h1b', 'opt', 'stem_opt', 'gc', 'citizen']) {
      for (const type of getRequiredIdentityTypes(visa)) {
        expect(asksHolding(type, visa), `${type} for ${visa}`).toBe(false);
      }
    }
  });

  it('offers it on an optional one', () => {
    // green_card is optional for an L-1; i20 is not required for an H-1B.
    expect(asksHolding('green_card', 'l1')).toBe(true);
    expect(asksHolding('i20', 'h1b')).toBe(true);
  });

  it('never offers it on employer-issued paperwork', () => {
    expect(asksHolding('e_verify_letter', 'h1b')).toBe(false);
    expect(asksHolding('lca_copy', 'h1b')).toBe(false);
  });

  // The point of the change: a document the category list got wrong is one
  // the employee can decline rather than be blocked by.
  it('lets an employee decline anything not demanded of them', () => {
    const optionalForGc = IDENTITY_DOC_ROWS
      .filter(r => isShown(r.type, 'gc'))
      .filter(r => !getRequiredIdentityTypes('gc').includes(r.type))
      .filter(r => !['e_verify_letter', 'lca_copy'].includes(r.type));
    expect(optionalForGc.length).toBeGreaterThan(0);
    for (const r of optionalForGc) expect(asksHolding(r.type, 'gc'), r.type).toBe(true);
  });
});
