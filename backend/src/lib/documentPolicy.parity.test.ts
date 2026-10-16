import { describe, it, expect } from 'vitest';
import {
  FALLBACK_POLICY, VISA_TYPES, buildPolicyIndex, wouldEmptyCategory,
  type DocState,
} from './documentPolicy';
import { buildPolicy, deriveState } from '../../scripts/generateDocumentPolicy';
import {
  IDENTITY_DOC_ROWS, EMPLOYER_DOC_ROWS, getRequiredIdentityTypes,
  ROW_VISA_EXCLUDE, ROW_VISA_GATE,
} from '../../../src/portal/lib/documentTypes';

/**
 * The gate for the document-policy catalogue.
 *
 * Nothing may read the tables until this passes. The claim is narrow and
 * total: FOR EVERY DOCUMENT AND EVERY WORK STATUS, the catalogue answers
 * exactly what the six scattered structures answer today.
 *
 * That matters more than usual here, because the thing being replaced decides
 * whether somebody can finish onboarding. A policy that is wrong in the
 * "required" direction blocks a real person from starting work; wrong in the
 * "hidden" direction and nobody is ever asked for a document that matters.
 */

const ALL_ROWS = [
  ...IDENTITY_DOC_ROWS.map(r => ({ type: r.type, employer: false })),
  ...EMPLOYER_DOC_ROWS.map(r => ({ type: r.type, employer: true })),
];

describe('the generated policy', () => {
  it('covers every document and every work status', () => {
    const rows = buildPolicy();
    expect(rows.length).toBe(ALL_ROWS.length);
    expect(rows.length).toBe(39);
    for (const r of rows) {
      expect(Object.keys(r.states).sort(), r.key).toEqual([...VISA_TYPES].sort());
    }
  });

  it('matches the committed FALLBACK_POLICY, so the file is not stale', () => {
    const generated = Object.fromEntries(buildPolicy().map(r => [r.key, {
      label: r.label, issuedBy: r.issuedBy, hasExpiry: r.hasExpiry, states: r.states,
    }]));
    expect(FALLBACK_POLICY).toEqual(generated);
  });

  it('uses only the three states', () => {
    const allowed: DocState[] = ['required', 'optional', 'hidden'];
    for (const entry of Object.values(FALLBACK_POLICY)) {
      for (const [visa, state] of Object.entries(entry.states)) {
        expect(allowed, `${visa}`).toContain(state);
      }
    }
  });
});

/**
 * The parity claim, document by document.
 *
 * `required` and `hidden` are each checked against their own source, because
 * conflating them is precisely the bug this replaces: a row can be required by
 * one structure and hidden by another, and today nothing notices.
 */
describe('every document resolves identically to the code', () => {
  const index = buildPolicyIndex([], FALLBACK_POLICY);   // empty table → fallback

  it('agrees with getRequiredIdentityTypes on what is REQUIRED', () => {
    const disagreements: string[] = [];
    for (const visa of VISA_TYPES) {
      const requiredToday = new Set(getRequiredIdentityTypes(visa));
      for (const { type, employer } of ALL_ROWS) {
        // Employer rows are never in the employee required set.
        const today = !employer && requiredToday.has(type);
        const model = index(type, visa) === 'required';
        if (today !== model) disagreements.push(`${type} [${visa}] today=${today} model=${model}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('agrees with the gate and exclude tables on what is HIDDEN', () => {
    const disagreements: string[] = [];
    for (const visa of VISA_TYPES) {
      for (const { type, employer } of ALL_ROWS) {
        if (employer) continue;                       // checked separately below
        // The wizard's inline rules are policy too, so they are part of
        // "today" — they are the reason i20 is OPT-only despite being in no
        // gate table.
        const inlineHidden =
          type === 'opt_card' || type === 'stem_opt_card' ||
          ((type === 'i983' || type === 'i20') && visa !== 'opt' && visa !== 'stem_opt');
        const gate = ROW_VISA_GATE[type];
        const todayHidden = inlineHidden
          || (ROW_VISA_EXCLUDE[type] ?? []).includes(visa)
          || (!!gate && !gate.includes(visa));
        const modelHidden = index(type, visa) === 'hidden';
        if (todayHidden !== modelHidden) {
          disagreements.push(`${type} [${visa}] todayHidden=${todayHidden} model=${modelHidden}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  // An employer document the employee is asked to upload would be a document
  // they cannot possibly produce.
  it('never marks an employer-issued document required', () => {
    for (const r of EMPLOYER_DOC_ROWS) {
      for (const visa of VISA_TYPES) {
        expect(index(r.type, visa), `${r.type} [${visa}]`).not.toBe('required');
      }
    }
  });

  // The opposite default is a real trap: employee rows default to visible,
  // employer rows to hidden.
  it('keeps employer documents hidden where their gate does not name the status', () => {
    expect(deriveState('i129', 'opt', true)).toBe('hidden');
    expect(deriveState('i129', 'h1b', true)).toBe('optional');
    expect(deriveState('e_verify_letter', 'gc', true)).toBe('optional');
  });
});

describe('the database answer, and what happens without one', () => {
  it('uses the stored state when the document is known', () => {
    const index = buildPolicyIndex(
      [{ document_key: 'passport', visa_type: 'h1b', state: 'optional' }],
      FALLBACK_POLICY,
    );
    expect(index('passport', 'h1b')).toBe('optional');     // the admin's decision
  });

  // Not an outage, and not a free-for-all.
  it('falls back to the compiled-in policy when the table is empty', () => {
    const index = buildPolicyIndex([], FALLBACK_POLICY);
    expect(index('passport', 'h1b')).toBe('required');
    expect(index('i20', 'h1b')).toBe('hidden');
  });

  it('falls back per DOCUMENT, not per table', () => {
    const index = buildPolicyIndex(
      [{ document_key: 'passport', visa_type: 'h1b', state: 'optional' }],
      FALLBACK_POLICY,
    );
    expect(index('passport', 'h1b')).toBe('optional');  // stored decision kept
    expect(index('i94', 'h1b')).toBe('required');       // untouched document falls back
  });

  // A known document silent about one status: hidden is the safe reading.
  // Showing a row nobody asked for is noise; demanding one blocks onboarding.
  it('hides a known document the table says nothing about for that status', () => {
    const index = buildPolicyIndex(
      [{ document_key: 'passport', visa_type: 'h1b', state: 'required' }],
      FALLBACK_POLICY,
    );
    expect(index('passport', 'opt')).toBe('hidden');
  });

  it('hides a document nobody has ever heard of', () => {
    expect(buildPolicyIndex([], {})('invented.document', 'h1b')).toBe('hidden');
  });
});

describe('emptying a category', () => {
  const rows = [
    { document_key: 'passport', visa_type: 'h1b', state: 'required' as DocState },
    { document_key: 'i94', visa_type: 'h1b', state: 'required' as DocState },
  ];

  it('flags the change that would leave a status requiring nothing', () => {
    const one = [rows[0]];
    expect(wouldEmptyCategory(one, { document_key: 'passport', visa_type: 'h1b', state: 'optional' }))
      .toBe(true);
  });

  it('does not flag it while another requirement remains', () => {
    expect(wouldEmptyCategory(rows, { document_key: 'passport', visa_type: 'h1b', state: 'optional' }))
      .toBe(false);
  });

  it('never flags a change that ADDS a requirement', () => {
    expect(wouldEmptyCategory([], { document_key: 'passport', visa_type: 'h1b', state: 'required' }))
      .toBe(false);
  });
});
