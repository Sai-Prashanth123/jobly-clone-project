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

  // Rewritten Oct 2026. This used to demand the whole I-140 petition trail
  // plus the I-797, and — via the work-visa conditional — the visa stamp and
  // I-94 from an entry that may be years past. HR: "Green card & Citizen
  // employees, I94 is not required. Visa also not required. I797 also not
  // required. I-140 not required." A permanent resident could not otherwise
  // reach 100% without paperwork they may no longer hold.
  it('asks a Green Card holder only for the card-adjacent paperwork', () => {
    const missing = missingDocs('gc', []);
    expect(missing).toEqual(expect.arrayContaining([
      'Passport (upload required)',
      'Labor Certificate (PERM) (upload required)',
      'Education Documents & Academic Credentials (upload required)',
      'Experience / Reference Letters (upload required)',
    ]));
  });

  it('no longer asks a Green Card holder for the petition trail or entry documents', () => {
    const missing = missingDocs('gc', []);
    for (const doc of [
      'I-140 (upload required)',
      'I-140 Approval Notice (upload required)',
      'I-797 (upload required)',
      'Visa (upload required)',
      'I-94 (upload required)',
    ]) {
      expect(missing, `gc should not require ${doc}`).not.toContain(doc);
    }
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

/**
 * The guarantee behind the Yes/No opt-out.
 *
 * An optional document can be answered "no" and the row stops asking for a
 * file. A REQUIRED document cannot — the wizard never offers the choice, and
 * these assertions hold the other end of that: even if an answer reaches the
 * record anyway (an older row, a visa change, a direct API call), nothing the
 * gate reads is `held`, so a declined requirement is still a missing
 * requirement.
 */
describe('a declined document can never satisfy a requirement', () => {
  it('still demands a required document the employee answered no to', () => {
    const result = computeOnboarding(
      {
        visa_type: 'stem_opt',
        identity_documents: [
          { type: 'i20', held: 'no' },
          { type: 'passport', held: 'no' },
        ],
      },
      new Set(),
    );
    const missing = result.missing.filter(l => l.endsWith('(upload required)'));
    expect(missing).toEqual(expect.arrayContaining([
      'I-20 (upload required)',
      'Passport (upload required)',
    ]));
    expect(result.complete).toBe(false);
  });

  // The completion figure is shown to the employee and to HR. If `held`
  // changed the denominator, answering "no" to a few optional rows would move
  // everyone's percentage for reasons nobody could explain.
  it('does not change the completion percentage', () => {
    const base = computeOnboarding({ visa_type: 'h1b' }, new Set());
    const withAnswers = computeOnboarding(
      {
        visa_type: 'h1b',
        identity_documents: [
          { type: 'driver_license', held: 'no' },
          { type: 'state_id', held: 'no' },
          { type: 'offer_letter', held: 'yes' },
        ],
      },
      new Set(),
    );
    expect(withAnswers.percent).toBe(base.percent);
    expect(withAnswers.missing).toEqual(base.missing);
  });

  it('ignores an answer on a document it has never heard of', () => {
    const result = computeOnboarding(
      { visa_type: 'citizen', identity_documents: [{ type: 'invented_thing', held: 'no' }] },
      new Set(),
    );
    expect(result.missing).toEqual(
      computeOnboarding({ visa_type: 'citizen' }, new Set()).missing,
    );
  });
});

/**
 * "Do you have this?" must be answered.
 *
 * HR: *"the option should force user to pick either of the option and if the
 * user pick Yes that should mandate to get the details and documents to
 * upload. If No then function should keeps to move next."*
 *
 * Before this the answer was inert: unanswered, yes and no all behaved
 * identically, and an optional document never appeared in the gate at all.
 */
describe('the mandatory yes/no answer', () => {
  const onboarding = (over: Record<string, unknown> = {}) => ({
    status: 'onboarding', visa_type: 'h1b', ...over,
  });

  it('blocks completion while an optional document is unanswered', () => {
    const r = computeOnboarding(onboarding(), new Set());
    const unanswered = r.missing.filter(l => l.endsWith('answer whether you have this'));
    expect(unanswered.length).toBeGreaterThan(0);
    expect(r.complete).toBe(false);
  });

  it('asks on every optional row for the work status', () => {
    // h1b has 14 optional employee rows; none of them may be skipped.
    const r = computeOnboarding(onboarding(), new Set());
    expect(r.items.filter(i => i.id.startsWith('held_')).length).toBe(14);
  });

  it('accepts a no and asks for nothing more', () => {
    const r = computeOnboarding(
      onboarding({ identity_documents: [{ type: 'driver_license', held: 'no' }] }),
      new Set(),
    );
    const item = r.items.find(i => i.id === 'held_driver_license');
    expect(item?.done).toBe(true);
    expect(r.missing).not.toContain("Driver's License — answer whether you have this");
  });

  // The half HR asked for explicitly: a yes is a promise to provide it.
  it('demands the upload once the answer is yes', () => {
    const r = computeOnboarding(
      onboarding({ identity_documents: [{ type: 'driver_license', held: 'yes' }] }),
      new Set(),
    );
    const item = r.items.find(i => i.id === 'held_driver_license');
    expect(item?.done).toBe(false);
    expect(item?.label).toContain('upload required');
  });

  it('is satisfied by a yes with the document on file', () => {
    const r = computeOnboarding(
      onboarding({ identity_documents: [{ type: 'driver_license', held: 'yes', expiry: '2030-01-01' }] }),
      new Set(["Driver's License"]),
    );
    expect(r.items.find(i => i.id === 'held_driver_license')?.done).toBe(true);
  });

  // Driver's License carries an expiry, so "details" means the expiry too.
  it('demands the expiry as well where the row has one', () => {
    const r = computeOnboarding(
      onboarding({ identity_documents: [{ type: 'driver_license', held: 'yes' }] }),
      new Set(["Driver's License"]),
    );
    expect(r.items.find(i => i.id === 'held_driver_license')?.done).toBe(false);
  });

  /**
   * The scope decision: active staff are not retroactively marked incomplete
   * for a question nobody asked them.
   */
  it('asks nothing of an employee who has already finished onboarding', () => {
    const r = computeOnboarding({ status: 'active', visa_type: 'h1b' }, new Set());
    expect(r.items.filter(i => i.id.startsWith('held_'))).toEqual([]);
  });

  // The documents section is locked until a work status is chosen, so there is
  // nothing to ask about yet.
  it('asks nothing before a work status is set', () => {
    const r = computeOnboarding({ status: 'onboarding' }, new Set());
    expect(r.items.filter(i => i.id.startsWith('held_'))).toEqual([]);
  });

  it('never asks about an employer-issued document', () => {
    const r = computeOnboarding(onboarding(), new Set());
    const ids = r.items.filter(i => i.id.startsWith('held_')).map(i => i.id);
    for (const employerRow of ['held_lca_copy', 'held_e_verify_letter', 'held_i129', 'held_paf']) {
      expect(ids, employerRow).not.toContain(employerRow);
    }
  });

  // A required document is not an optional one, and must not appear twice in
  // the missing list under two different wordings.
  it('does not double-count a document that is already required', () => {
    const r = computeOnboarding(onboarding(), new Set());
    const heldLabels = r.items.filter(i => i.id.startsWith('held_')).map(i => i.label);
    for (const required of ['Resume', 'Social Security Card', 'W-4', 'Passport', 'I-94']) {
      expect(heldLabels.filter(l => l.startsWith(required + ' ')), required).toEqual([]);
    }
  });

  it('honours a live catalogue passed by the caller', () => {
    const r = computeOnboarding(onboarding(), new Set(), undefined, [
      { key: 'driver_license', label: "Driver's License", hasExpiry: true },
    ]);
    expect(r.items.filter(i => i.id.startsWith('held_')).length).toBe(1);
  });

  /**
   * A file on record IS the answer.
   *
   * The wizard reads an upload as an implicit yes, and only persists `held`
   * when somebody actually clicks a button. Demanding the click here refused
   * every record that had the document but no click — the form showed 100% and
   * "Finish onboarding" answered "Still required: Driver's License — answer
   * whether you have this". It blocked HR's approve path for the same records.
   */
  describe('an uploaded document answers its own question', () => {
    const LICENCE = [{ key: 'driver_license', label: "Driver's License", hasExpiry: true }];
    const held = (emp: Record<string, unknown>, docs: string[] = []) =>
      computeOnboarding(onboarding(emp), new Set(docs), undefined, LICENCE)
        .missing.filter(l => l.startsWith("Driver's License"));

    it('needs no click once the document and its expiry are on file', () => {
      expect(held(
        { identity_documents: [{ type: 'driver_license', expiry: '2030-01-01' }] },
        ["Driver's License"],
      )).toEqual([]);
    });

    it('treats the upload as a yes and then wants the expiry', () => {
      // Not "answer whether you have this" — the answer is evident. What is
      // genuinely missing is the date the alerts read.
      expect(held(
        { identity_documents: [{ type: 'driver_license' }] },
        ["Driver's License"],
      )).toEqual(["Driver's License (upload required — you answered yes)"]);
    });

    it('still asks when there is no document and no answer', () => {
      expect(held({})).toEqual(["Driver's License — answer whether you have this"]);
    });

    it('lets a stored "no" stand even if a file exists', () => {
      // An explicit answer outranks an inference, both here and in the wizard.
      expect(held(
        { identity_documents: [{ type: 'driver_license', held: 'no' }] },
        ["Driver's License"],
      )).toEqual([]);
    });
  });
});
