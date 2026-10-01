import { describe, it, expect } from 'vitest';
import { computeOnboarding, ONBOARDING_REQUIRED_DOCS } from './onboarding';

// HR reported a STEM OPT employee finishing onboarding without an I-9. The
// per-visa-type requirements (I-9 / I-20 / EAD, and the Green Card petition
// paperwork) existed only in the frontend wizard, so the server-side gate was
// strictly weaker than the screen and let anything that bypassed the wizard
// through.
//
// Only the document half is asserted here; the rest of the checklist (personal
// details, addresses, bank, etc.) is left incomplete on purpose, so these
// assertions are about which DOCUMENT items appear as missing.
const missingDocs = (visaType: string, docTypes: string[]): string[] =>
  computeOnboarding({ visa_type: visaType }, new Set(docTypes))
    .missing.filter(label => label.endsWith('(upload required)'));

describe('computeOnboarding document requirements', () => {
  it('requires I-9, I-20 and EAD for STEM OPT', () => {
    const missing = missingDocs('stem_opt', []);
    expect(missing).toEqual(expect.arrayContaining([
      'I-9 Form (upload required)',
      'I-20 (upload required)',
      'Employment Authorization Document (upload required)',
    ]));
  });

  it('requires the universal set for everyone', () => {
    const missing = missingDocs('citizen', []);
    expect(missing).toEqual(expect.arrayContaining([
      'Resume (upload required)',
      'Social Security Card (upload required)',
      'W-4 (upload required)',
      'Insurance Waiver Form (upload required)',
    ]));
  });

  it('does not ask a US citizen for a visa or I-94', () => {
    const missing = missingDocs('citizen', []);
    expect(missing).not.toContain('Visa (upload required)');
    expect(missing).not.toContain('I-94 (upload required)');
    expect(missing).not.toContain('I-20 (upload required)');
  });

  it('requires the petition paperwork for Green Card', () => {
    const missing = missingDocs('gc', []);
    expect(missing).toEqual(expect.arrayContaining([
      'I-140 (upload required)',
      'I-140 Approval Notice (upload required)',
      'Labor Certificate (PERM) (upload required)',
      'I-797 (upload required)',
    ]));
  });

  it('does not list the same document twice', () => {
    // Visa is in BOTH the work-visa conditional list and stem_opt's extras;
    // Passport is in both the conditional list and the Green Card extras.
    for (const visa of ['stem_opt', 'gc']) {
      const missing = missingDocs(visa, []);
      expect(missing.length).toBe(new Set(missing).size);
    }
  });

  it('clears a requirement once the document is uploaded', () => {
    const before = missingDocs('stem_opt', []);
    const after = missingDocs('stem_opt', ['I-9 Form']);
    expect(before).toContain('I-9 Form (upload required)');
    expect(after).not.toContain('I-9 Form (upload required)');
  });

  it('accepts a document filed under its legacy label', () => {
    // "US Visa" was renamed to "Visa"; anything already on file under the old
    // label must still satisfy the requirement.
    //
    // Visa is a CONDITIONAL document for work-visa holders, so it needs the
    // expiry date recorded on identity_documents as well as the upload — the
    // upload alone is deliberately not enough.
    const withExpiry = computeOnboarding(
      { visa_type: 'stem_opt', identity_documents: [{ type: 'us_visa', expiry: '2030-01-01' }] },
      new Set(['US Visa']),
    ).missing;
    expect(withExpiry).not.toContain('Visa (upload required)');

    // Upload under the legacy label but no expiry -> still outstanding.
    expect(missingDocs('stem_opt', ['US Visa'])).toContain('Visa (upload required)');
  });
});

// The expiry half of the same gap. The wizard demands an expiry date for
// every required row with hasExpiry — which, through the per-visa extras,
// includes I-20, the EAD and I-797 — while this file required one only for
// Passport/Visa/I-94. So "Finish onboarding" accepted an I-20 with no expiry.
// Those dates are what the visa-expiry alerts and Expiring Documents read, so
// a blank one means the document silently never expires and nobody is warned.
describe('computeOnboarding expiry requirements', () => {
  // The universal set as well, so what is left in `missing` is only ever
  // about expiry dates rather than documents this fixture forgot to upload.
  const STEM_DOCS = [
    ...ONBOARDING_REQUIRED_DOCS,
    'I-9 Form', 'I-20', 'Employment Authorization Document',
    'Passport', 'Visa', 'I-94',
  ];
  const missingWith = (identityDocuments: unknown[]) =>
    computeOnboarding({ visa_type: 'stem_opt', identity_documents: identityDocuments }, new Set(STEM_DOCS))
      .missing.filter(l => l.endsWith('(upload required)'));

  it('still demands the I-20 when it is uploaded but has no expiry', () => {
    const missing = missingWith([
      { type: 'passport', expiry: '2030-01-01' },
      { type: 'us_visa', expiry: '2030-01-01' },
      { type: 'i94', expiry: '2030-01-01' },
      { type: 'ead', expiry: '2030-01-01' },
      { type: 'i20' },                              // uploaded, no expiry
    ]);
    expect(missing).toContain('I-20 (upload required)');
  });

  it('demands the EAD expiry too', () => {
    const missing = missingWith([
      { type: 'passport', expiry: '2030-01-01' },
      { type: 'us_visa', expiry: '2030-01-01' },
      { type: 'i94', expiry: '2030-01-01' },
      { type: 'i20', expiry: '2030-01-01' },
      { type: 'ead', expiry: '' },                  // blank counts as missing
    ]);
    expect(missing).toContain('Employment Authorization Document (upload required)');
  });

  it('is satisfied once every expiry is present', () => {
    const missing = missingWith([
      { type: 'passport', expiry: '2030-01-01' },
      { type: 'us_visa', expiry: '2030-01-01' },
      { type: 'i94', expiry: '2030-01-01' },
      { type: 'i20', expiry: '2030-01-01' },
      { type: 'ead', expiry: '2030-01-01' },
    ]);
    expect(missing).toEqual([]);
  });

  it('does not demand an expiry for a document that has no expiry field', () => {
    // I-9 Form is a required STEM OPT extra but carries no hasExpiry row, so
    // the upload alone must satisfy it.
    const missing = missingWith([
      { type: 'passport', expiry: '2030-01-01' },
      { type: 'us_visa', expiry: '2030-01-01' },
      { type: 'i94', expiry: '2030-01-01' },
      { type: 'i20', expiry: '2030-01-01' },
      { type: 'ead', expiry: '2030-01-01' },
    ]);
    expect(missing).not.toContain('I-9 Form (upload required)');
  });
});
