// Contract tests: rules that exist in BOTH the frontend and the backend and
// must agree.
//
// This file exists because drift between those two copies caused a string of
// production bugs:
//   - the password policy lived in four places and all four disagreed
//   - the per-visa required documents (I-9 / I-20 / EAD, the Green Card
//     paperwork) were enforced only in the wizard, so the server-side gate was
//     strictly weaker and a STEM OPT employee onboarded without an I-9
//   - a document label was renamed on the frontend and existing uploads
//     stopped counting until a legacy alias was added on both sides
//
// Nothing caught any of it, because nothing compared the two copies. This does.
//
// Both modules are deliberately pure (zero imports), so this can import across
// the tree. backend/tsconfig.json excludes src/**/*.test.ts, so reaching
// outside rootDir here cannot break `tsc --noEmit`.
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_REQUIRED_DOCS,
  VISA_TYPES_REQUIRING_PASSPORT_I94 as BACKEND_WORK_VISA_TYPES,
  VISA_CONDITIONAL_REQUIRED_DOCS as BACKEND_CONDITIONAL_DOCS,
  VISA_REQUIRED_EXTRA_DOCS as BACKEND_VISA_EXTRAS,
  DOC_TYPE_LEGACY_ALIASES as BACKEND_LEGACY_ALIASES,
  EXPIRY_REQUIRED_DOC_KEYS as BACKEND_EXPIRY_KEYS,
} from './onboarding';
import {
  REQUIRED_IDENTITY_TYPES,
  IDENTITY_DOC_ROWS,
  WORK_VISA_TYPES,
  WORK_VISA_REQUIRED_DOCS,
  VISA_REQUIRED_EXTRA,
  LEGACY_LABEL_ALIASES,
} from '../../../src/portal/lib/documentTypes';

/** The frontend stores row TYPES; the backend stores row LABELS. */
const labelOf = (rowType: string): string => {
  const row = IDENTITY_DOC_ROWS.find(r => r.type === rowType);
  if (!row) throw new Error(`No IDENTITY_DOC_ROWS entry for type "${rowType}"`);
  return row.label;
};
const sorted = (xs: readonly string[]) => [...xs].sort();

describe('frontend/backend document rules agree', () => {
  it('universal required documents match', () => {
    expect(sorted(REQUIRED_IDENTITY_TYPES.map(labelOf))).toEqual(sorted(ONBOARDING_REQUIRED_DOCS));
  });

  it('the set of visa types needing passport/visa/I-94 matches', () => {
    expect(sorted([...WORK_VISA_TYPES])).toEqual(sorted([...BACKEND_WORK_VISA_TYPES]));
  });

  it('the conditional documents for those visa types match', () => {
    expect(sorted(WORK_VISA_REQUIRED_DOCS.map(labelOf))).toEqual(sorted(BACKEND_CONDITIONAL_DOCS));
  });

  it('the per-visa-type extra documents match, visa type by visa type', () => {
    expect(sorted(Object.keys(VISA_REQUIRED_EXTRA))).toEqual(sorted(Object.keys(BACKEND_VISA_EXTRAS)));
    for (const visa of Object.keys(VISA_REQUIRED_EXTRA)) {
      expect(sorted(VISA_REQUIRED_EXTRA[visa].map(labelOf)), `visa type "${visa}"`)
        .toEqual(sorted(BACKEND_VISA_EXTRAS[visa]));
    }
  });

  it('legacy label aliases match, so renames never orphan existing uploads', () => {
    expect(sorted(Object.keys(LEGACY_LABEL_ALIASES))).toEqual(sorted(Object.keys(BACKEND_LEGACY_ALIASES)));
    for (const label of Object.keys(LEGACY_LABEL_ALIASES)) {
      expect(sorted(LEGACY_LABEL_ALIASES[label]), `aliases for "${label}"`)
        .toEqual(sorted(BACKEND_LEGACY_ALIASES[label]));
    }
  });

  // The backend gate was weaker than the wizard here: the wizard demands an
  // expiry for EVERY required row with hasExpiry (which includes I-20, the EAD
  // and I-797 via the per-visa extras), while onboarding.ts required one only
  // for Passport/Visa/I-94. So onboarding could be finished with an I-20 on
  // file and no expiry — and that date is what drives the visa-expiry alerts.
  it('demands an expiry for exactly the required rows that have hasExpiry', () => {
    // Every label that can appear in a required list, from either side.
    const requiredLabels = new Set<string>([
      ...ONBOARDING_REQUIRED_DOCS,
      ...BACKEND_CONDITIONAL_DOCS,
      ...Object.values(BACKEND_VISA_EXTRAS).flat(),
    ]);
    const shouldNeedExpiry = IDENTITY_DOC_ROWS
      .filter(r => r.hasExpiry && requiredLabels.has(r.label))
      .map(r => r.label);
    expect(sorted(Object.keys(BACKEND_EXPIRY_KEYS))).toEqual(sorted(shouldNeedExpiry));
  });

  it('maps each expiry-bearing label to the row type the wizard stores', () => {
    // The lookup reads identity_documents[].type, so a wrong key silently
    // finds no entry and the requirement can never be satisfied.
    for (const [label, key] of Object.entries(BACKEND_EXPIRY_KEYS)) {
      const row = IDENTITY_DOC_ROWS.find(r => r.label === label);
      expect(row, `no IDENTITY_DOC_ROWS row labelled "${label}"`).toBeDefined();
      expect(row!.type, `expiry key for "${label}"`).toBe(key);
    }
  });

  it('every required document label actually exists as a row', () => {
    // Catches a typo in either list: a label the backend demands but no row
    // can ever produce is a requirement nobody can satisfy.
    const rowLabels = new Set(IDENTITY_DOC_ROWS.map(r => r.label));
    for (const label of [...ONBOARDING_REQUIRED_DOCS, ...BACKEND_CONDITIONAL_DOCS]) {
      expect(rowLabels.has(label), `"${label}" is required but matches no IDENTITY_DOC_ROWS row`).toBe(true);
    }
    for (const labels of Object.values(BACKEND_VISA_EXTRAS)) {
      for (const label of labels) {
        expect(rowLabels.has(label), `"${label}" is required but matches no IDENTITY_DOC_ROWS row`).toBe(true);
      }
    }
  });
});
