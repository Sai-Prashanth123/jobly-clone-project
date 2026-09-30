import { describe, it, expect } from 'vitest';
import { computeOnboarding } from './onboarding';

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
