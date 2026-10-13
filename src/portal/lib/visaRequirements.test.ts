import { describe, it, expect } from 'vitest';
import { getRequiredIdentityTypes, WORK_VISA_TYPES, IDENTITY_DOC_ROWS } from './documentTypes';

/**
 * HR (Oct 2026): "Green card & Citizen employees, I94 is not required. Visa
 * also not required. I797 also not required. I-140 not required."
 *
 * Green Card previously demanded 13 documents — including the visa stamp and
 * I-94 from an entry that may be years past, and the whole I-140 petition
 * trail. A permanent resident could not reach 100% without paperwork they may
 * no longer hold.
 *
 * These assert the rule itself. `contracts.test.ts` on the backend separately
 * asserts that the server agrees with it — parity alone would happily pin two
 * copies of the wrong rule.
 */

const required = (visa: string) => getRequiredIdentityTypes(visa);

describe('Green Card', () => {
  it('does not ask for the visa stamp, I-94, I-797 or the I-140 pair', () => {
    for (const t of ['us_visa', 'i94', 'i797', 'i140', 'i140_approval_notice']) {
      expect(required('gc'), `gc should not require ${t}`).not.toContain(t);
    }
  });

  it('still asks for the passport and the employment history behind the card', () => {
    for (const t of ['passport', 'education_documents', 'experience_letters', 'labor_certificate']) {
      expect(required('gc'), `gc should require ${t}`).toContain(t);
    }
  });

  it('still asks for the four documents everyone provides', () => {
    for (const t of ['ssn', 'resume', 'w4', 'insurance_waiver']) {
      expect(required('gc')).toContain(t);
    }
  });

  it('is no longer treated as a work-visa holder', () => {
    expect(WORK_VISA_TYPES.has('gc')).toBe(false);
  });
});

describe('US citizens', () => {
  it('need only the universal four', () => {
    expect(required('citizen').sort()).toEqual(['insurance_waiver', 'resume', 'ssn', 'w4']);
  });

  it('are never asked for immigration paperwork', () => {
    for (const t of ['passport', 'us_visa', 'i94', 'i797', 'i140', 'i20', 'ead']) {
      expect(required('citizen'), `citizen should not require ${t}`).not.toContain(t);
    }
  });
});

describe('visa holders are unaffected', () => {
  // The relaxation must not leak into the categories that genuinely need these.
  it('still requires passport, visa and I-94 for H-1B, L-1, TN and H-4 EAD', () => {
    for (const visa of ['h1b', 'l1', 'tn', 'h4_ead']) {
      for (const t of ['passport', 'us_visa', 'i94']) {
        expect(required(visa), `${visa} should require ${t}`).toContain(t);
      }
    }
  });

  it('still requires the I-20 and EAD for OPT and STEM OPT', () => {
    for (const visa of ['opt', 'stem_opt']) {
      expect(required(visa)).toContain('i20');
      expect(required(visa)).toContain('ead');
      expect(required(visa)).toContain('i9_form');
    }
  });

  it('still requires the I-797 for H-4 EAD', () => {
    expect(required('h4_ead')).toContain('i797');
  });
});

describe('every required type is a real row', () => {
  // A typo here is a requirement nobody can ever satisfy.
  it('matches an IDENTITY_DOC_ROWS entry for every visa type', () => {
    const known = new Set(IDENTITY_DOC_ROWS.map(r => r.type));
    for (const visa of ['citizen', 'gc', 'h1b', 'l1', 'opt', 'stem_opt', 'h4_ead', 'tn', 'other']) {
      for (const t of required(visa)) {
        expect(known.has(t), `"${t}" is required for ${visa} but matches no row`).toBe(true);
      }
    }
  });
});
