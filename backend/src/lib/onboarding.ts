// Single source of truth for what a new hire must complete during self-onboarding.
// Used to (a) gate dashboard access, (b) show HR a completion % + what's missing,
// (c) validate the "Finish onboarding" action server-side.
//
// Employment documents in ONBOARDING_REQUIRED_DOCS are mandatory for everyone.
// Identity documents are conditional, not optional: a visa type is required, and
// VISA_TYPES_REQUIRING_PASSPORT_I94 / VISA_REQUIRED_EXTRA_DOCS then demand
// Passport, Visa and I-94 plus the per-visa extras (I-20 and EAD for OPT and
// STEM OPT, the Green Card paperwork for gc).
//
// These lists are mirrored in src/portal/lib/documentTypes.ts and the two are
// held in step by backend/src/lib/contracts.test.ts — change one and that test
// fails until the other matches. A third copy used to live in this file
// (COMPLIANCE_REQUIRED_DOC_TYPES), was imported by nothing, and had drifted to
// carry two rules that were wrong by the time it was deleted.

// MUST mirror REQUIRED_IDENTITY_TYPES in src/portal/lib/documentTypes.ts
// (by row label, not row type) — the wizard computes its progress from that
// list while this one gates the server-side "Finish onboarding" action, so a
// mismatch either blocks a 100%-complete employee or lets an incomplete one
// through. Offer Letter was dropped here after HR made it optional on the
// frontend: the wizard showed 100% while this list still demanded it, so
// Finish onboarding failed with "Still required: Offer Letter". W-4 was added
// when it became required for every employee.
// The compiled-in document catalogue. Pure data with no imports of its own,
// so this stays a database-free module.
import { FALLBACK_POLICY, type PolicyEntry } from './documentPolicy';

export const ONBOARDING_REQUIRED_DOCS = [
  'Resume',
  'Social Security Card',
  'W-4',
  // Company form every employee files regardless of immigration status, so
  // it sits here rather than in the visa-conditional list below.
  'Insurance Waiver Form',
] as const;

// Passport and I-94 are only relevant to non-immigrant work-visa holders — an
// I-94 is an arrival/departure record issued at US entry to visa entrants, and
// many employees (US citizens, green card holders) legitimately have neither
// document. Mirrors getRequiredIdentityTypes() in
// src/portal/lib/documentTypes.ts on the frontend — keep the visa-type list
// in sync between the two.
// HR's mandatory set is Passport, SSN, Visa, I-94, W-4, Insurance Waiver and
// Resume. The ones every employee can produce are in ONBOARDING_REQUIRED_DOCS
// above; Passport, Visa and I-94 are added for work-visa holders only, since a
// US citizen has none of them and would otherwise never finish onboarding.
// Green Card included per HR - they entered on a visa and were issued an I-94,
// and both are kept on file. US citizens stay out: they have neither, so
// requiring them would block onboarding permanently.
// Mirrors WORK_VISA_TYPES in src/portal/lib/documentTypes.ts.
// 'gc' removed per HR (Oct 2026) — see the note on WORK_VISA_TYPES in
// src/portal/lib/documentTypes.ts, which this mirrors.
export const VISA_TYPES_REQUIRING_PASSPORT_I94 = new Set(['h1b', 'l1', 'l2', 'opt', 'stem_opt', 'h4_ead', 'tn']);
export const VISA_CONDITIONAL_REQUIRED_DOCS = ['Passport', 'Visa', 'I-94'] as const;

// Documents required for a SPECIFIC visa type, on top of the universal list
// and the passport/visa/I-94 conditional above.
//
// This existed only on the frontend (VISA_REQUIRED_EXTRA in
// src/portal/lib/documentTypes.ts), so the server-side gate was strictly
// weaker than the wizard: it never asked a STEM OPT employee for an I-9, an
// I-20 or an EAD, and never asked a Green Card holder for any of their
// petition paperwork. Anything that got past the wizard - a stale tab, a
// direct POST, or a wizard checklist that passed for a different reason -
// finished onboarding with those documents missing. HR reported exactly that:
// a STEM OPT employee onboarding without an I-9.
//
// Keyed BY LABEL, because documents.type stores the row's label. Mirrors
// VISA_REQUIRED_EXTRA - keep the two in step.
export const VISA_REQUIRED_EXTRA_DOCS: Record<string, readonly string[]> = {
  // H-1B, per HR. Only the two the EMPLOYEE can produce: the LCA and the
  // E-Verify letter are the employer's to issue, so requiring them here would
  // make onboarding impossible to finish. They are tracked on the employee
  // record instead (EMPLOYER_REQUIRED_BY_VISA, frontend).
  h1b: ['I-9 Form', 'I-797'],
  opt: ['I-9 Form', 'I-20', 'Employment Authorization Document'],
  stem_opt: ['I-9 Form', 'I-20', 'Employment Authorization Document', 'Visa'],
  h4_ead: ['I-9 Form', 'Employment Authorization Document', 'I-797'],
  // I-94, Visa, I-797 and the I-140 pair dropped per HR (Oct 2026).
  gc: [
    'Passport',
    'Education Documents & Academic Credentials',
    'Experience / Reference Letters',
    'Labor Certificate (PERM)',
  ],
};
// Maps a doc label to its identity_documents[].type key (lowercase, matches
// IDENTITY_DOC_ROWS in src/portal/lib/documentTypes.ts) for every document
// whose EXPIRY DATE is also required.
//
// This covers the per-visa extras too, not just Passport/Visa/I-94. The
// wizard computes its required set as REQUIRED_IDENTITY_TYPES + conditional
// + per-visa extras and then demands an expiry for every one of them with
// hasExpiry — which includes I-20, the EAD and I-797. This file required an
// expiry for only the first three, so the server-side gate was strictly
// weaker than the wizard and "Finish onboarding" could pass with an I-20 or
// EAD on file and no expiry date. Those dates are what feed the visa-expiry
// alerts and the Expiring Documents page, so a blank one is not cosmetic:
// the document silently never expires and nobody is ever warned.
//
// Held in step with the frontend by contracts.test.ts.
export const EXPIRY_REQUIRED_DOC_KEYS: Record<string, string> = {
  Passport: 'passport',
  Visa: 'us_visa',
  'I-94': 'i94',
  'I-20': 'i20',
  'Employment Authorization Document': 'ead',
  'I-797': 'i797',
};

/**
 * How each `identity_documents[].type` key is NAMED to a human.
 *
 * The Expiring Documents list was showing raw keys — HR was reading "i20",
 * "opt_card" and "us_visa" — because those rows carry a `type` and only
 * sometimes a `label`, and the fallback was the key itself.
 *
 * Mirrors IDENTITY_DOC_ROWS in src/portal/lib/documentTypes.ts, which is where
 * these labels are authored. contracts.test.ts asserts the two agree, because
 * a label that drifts here shows the wrong name on a compliance report.
 */
export const IDENTITY_DOC_TYPE_LABELS: Record<string, string> = {
  ssn: 'Social Security Card',
  driver_license: "Driver's License",
  state_id: 'State-Issued ID',
  passport: 'Passport',
  green_card: 'Permanent Resident Card',
  ead: 'Employment Authorization Document',
  opt_card: 'OPT Card',
  stem_opt_card: 'STEM OPT Card',
  i983: 'I-983',
  i20: 'I-20',
  i94: 'I-94',
  us_visa: 'Visa',
  resume: 'Resume',
  offer_letter: 'Offer Letter',
  i9_form: 'I-9 Form',
  w4: 'W-4',
  insurance_waiver: 'Insurance Waiver Form',
  i140_questionnaire: 'I-140 Beneficiary Questionnaire (EB2&3)',
  perm_questionnaire: 'PERM Questionnaire - Employee',
  h1b_employee_questionnaire: 'H-1B Employee Questionnaire',
  h4_beneficiary_questionnaire: 'H-4 Beneficiary Questionnaire',
  i797: 'I-797',
  pay_stubs_w2_tax_returns: 'Pay Stubs, W-2s & Tax Returns',
  vendor_letter: 'Vendor Letter',
  project_documents: 'Project-Related Documents',
  lca: 'LCA',
  experience_letters: 'Experience / Reference Letters',
  education_documents: 'Education Documents & Academic Credentials',
  certificates: 'Certificates',
  i140: 'I-140',
  i140_approval_notice: 'I-140 Approval Notice',
  labor_certificate: 'Labor Certificate (PERM)',
  other: 'Other Documents',
};

/** Display name for an identity-document row. Falls back to the raw key. */
export function identityDocLabel(type?: string | null, label?: string | null): string {
  if (label && label.trim()) return label;
  if (!type) return 'Document';
  return IDENTITY_DOC_TYPE_LABELS[type] ?? type;
}

/**
 * Mirrors LEGACY_LABEL_ALIASES in src/portal/lib/documentTypes.ts, and
 * contracts.test.ts asserts the two are identical — this is the half the
 * ONBOARDING GATE reads, so a spelling missing here blocks somebody from
 * finishing onboarding over a document they have already uploaded.
 *
 * The entries marked "from live data" came from auditing the 42 distinct
 * labels in production: nine were unrecognised, and between them they made one
 * OPT employee appear to be missing three documents they had provided.
 */
export const DOC_TYPE_LEGACY_ALIASES: Record<string, string[]> = {
  // 'SSN', 'SN copy' and 'Social Security' are from live data.
  'Social Security Card': ['Social Security Number', 'SSN', 'SN copy', 'Social Security'],
  // Row renamed from "US Visa" per HR. Mirrors LEGACY_LABEL_ALIASES in
  // src/portal/lib/documentTypes.ts - documents uploaded under the old label
  // must still satisfy the requirement, or employees who already provided it
  // would be blocked from finishing.
  // 'Visa copy' is from live data.
  Visa: ['US Visa', 'Visa copy'],
  // The OPT and STEM OPT cards ARE the EAD — the same physical card. They had
  // their own rows, so an OPT employee saw "EAD / STEM OPT Card" and
  // "STEM OPT Card" side by side and was asked for one card twice. The rows
  // are gone; aliasing the old labels here means anything already uploaded
  // under them still counts for the EAD requirement and still appears, rather
  // than silently going missing from a completed checklist.
  // 'EAD' and 'EAD Copy' are from live data — the abbreviation people type.
  'Employment Authorization Document': ['OPT Card', 'STEM OPT Card', 'EAD', 'EAD Copy'],
  // All three from live data.
  'I-20': ['I-20 copy'],
  'I-983': ['I-983 Form'],
  Resume: ['Latest Resume'],
};

export interface OnboardingItem {
  id: string;
  label: string;
  done: boolean;
}

export interface OnboardingResult {
  percent: number; // 0..100
  complete: boolean;
  missing: string[]; // labels of the incomplete required items
  items: OnboardingItem[];
}

const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/** One row of the employee's `identity_documents` jsonb array. */
interface IdentityDocEntry { type?: string; expiry?: string }

/**
 * The expiry date the employee entered for a given identity-document row, or
 * undefined when the row carries no expiry requirement (`key` undefined) or
 * nothing has been entered.
 *
 * Shared by the conditional and per-visa-extra blocks below, which previously
 * each re-derived this inline.
 */
function expiryFor(identityDocuments: unknown, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const docs: IdentityDocEntry[] = Array.isArray(identityDocuments) ? identityDocuments : [];
  return docs.find(d => d?.type === key)?.expiry;
}
const numPositive = (v: unknown): boolean => v != null && !Number.isNaN(Number(v)) && Number(v) > 0;

/** The stored "do you have this?" answer for a document row, if any. */
function heldFor(identityDocuments: unknown, key: string): 'yes' | 'no' | undefined {
  const docs: IdentityDocEntry[] = Array.isArray(identityDocuments) ? identityDocuments : [];
  const held = (docs.find(d => d?.type === key) as { held?: unknown } | undefined)?.held;
  return held === 'yes' || held === 'no' ? held : undefined;
}

/**
 * The optional documents a work status shows, as {key, label, hasExpiry}.
 *
 * Read from the compiled-in catalogue so this module stays free of database
 * imports. The caller may pass the live list instead, exactly as it does for
 * policyExtras.
 */
export function optionalDocsFor(visaType: string): Array<{ key: string; label: string; hasExpiry: boolean }> {
  const out: Array<{ key: string; label: string; hasExpiry: boolean }> = [];
  for (const [key, entry] of Object.entries(FALLBACK_POLICY) as Array<[string, PolicyEntry]>) {
    // Employer-issued paperwork is never the employee's to answer for.
    if (entry.issuedBy === 'employer') continue;
    if (entry.states[visaType] !== 'optional') continue;
    out.push({ key, label: entry.label, hasExpiry: entry.hasExpiry });
  }
  return out;
}

/**
 * @param policyExtras the per-visa documents this work status requires, by
 *   LABEL, resolved from the document-policy catalogue by the caller.
 *
 *   Passed in rather than read here so this function stays synchronous and
 *   pure — it is called from five places including two that gate onboarding,
 *   and making it async would ripple through all of them for no benefit. When
 *   absent it falls back to the compiled-in VISA_REQUIRED_EXTRA_DOCS, so an
 *   unreachable catalogue behaves exactly as before rather than demanding
 *   nothing.
 */
export function computeOnboarding(
  emp: any,
  docTypes: Set<string>,
  policyExtras?: string[],
  optionalDocs?: Array<{ key: string; label: string; hasExpiry: boolean }>,
): OnboardingResult {
  const education: any[] = Array.isArray(emp.education) ? emp.education : [];

  /**
   * "Do you have this?" is a question that must be answered.
   *
   * HR: *"the option should force user to pick either of the option and if the
   * user pick Yes that should mandate to get the details and documents to
   * upload. If No then function should keeps to move next."*
   *
   * So an optional document is no longer inert. Unanswered blocks; Yes pulls
   * the upload (and the expiry, where the row has one) into the required set;
   * No satisfies the item and asks for nothing.
   *
   * ONLY WHILE SOMEBODY IS STILL ONBOARDING. Applying it to active staff would
   * retroactively mark ten finished records incomplete for questions nobody
   * was asked at the time.
   */
  const asksHolding = String(emp.status ?? '') === 'onboarding' && nonEmpty(emp.visa_type);
  const holdingChecks: OnboardingItem[] = asksHolding
    ? (optionalDocs ?? optionalDocsFor(String(emp.visa_type)))
        // A document already demanded elsewhere is not an optional one.
        .filter(d => !(ONBOARDING_REQUIRED_DOCS as readonly string[]).includes(d.label))
        .filter(d => !(VISA_CONDITIONAL_REQUIRED_DOCS as readonly string[]).includes(d.label))
        .map(d => {
          const uploaded = docTypes.has(d.label)
            || (DOC_TYPE_LEGACY_ALIASES[d.label] ?? []).some(alias => docTypes.has(alias));
          // A file on record IS the answer. The wizard reads it that way
          // (NewEmployee.tsx: `stored?.held ?? (fileOrUploaded ? 'yes' :
          // undefined)`) and identityDocsForPersist only writes `held` when
          // somebody actually clicked a button — so demanding the click here
          // refused records the form itself showed as 100% complete, for
          // everybody mid-onboarding at once, and blocked HR's approve path
          // with them.
          const answer = heldFor(emp.identity_documents, d.key) ?? (uploaded ? 'yes' : undefined);
          if (answer === undefined) {
            return {
              id: `held_${d.key}`,
              label: `${d.label} — answer whether you have this`,
              done: false,
            };
          }
          if (answer === 'no') {
            // Answered, and the answer asks for nothing further.
            return { id: `held_${d.key}`, label: `${d.label} — answered`, done: true };
          }
          // Yes: now it behaves exactly like a required document.
          const expiry = d.hasExpiry ? expiryFor(emp.identity_documents, d.key) : 'n/a';
          return {
            id: `held_${d.key}`,
            label: `${d.label} (upload required — you answered yes)`,
            done: uploaded && nonEmpty(expiry),
          };
        })
    : [];

  const checks: OnboardingItem[] = [
    // Personal — photo is intentionally optional (the wizard labels it "optional but
    // recommended" but the strict gate used to block submission when missing).
    { id: 'dob',                label: 'Date of birth',                                       done: nonEmpty(emp.dob) },
    { id: 'gender',             label: 'Gender',                                              done: nonEmpty(emp.gender) },
    { id: 'marital_status',     label: 'Marital status',                                      done: nonEmpty(emp.marital_status) },
    { id: 'nationality',        label: 'Nationality',                                         done: nonEmpty(emp.nationality) },
    { id: 'blood_group',        label: 'Blood group',                                         done: nonEmpty(emp.blood_group) },
    { id: 'preferred_language', label: 'Preferred language',                                  done: nonEmpty(emp.preferred_language) },

    // Contact
    { id: 'phone',              label: 'Phone number',                                        done: nonEmpty(emp.phone) },
    { id: 'linkedin_url',       label: 'LinkedIn URL',                                        done: nonEmpty(emp.linkedin_url) },
    {
      id: 'present_address',    label: 'Present address (street, city, state, zip)',
      done: nonEmpty(emp.address_street) && nonEmpty(emp.address_city)
        && nonEmpty(emp.address_state) && nonEmpty(emp.address_zip),
    },
    {
      id: 'permanent_address',  label: 'Permanent address (street, city, state, zip)',
      done: nonEmpty(emp.permanent_address_street) && nonEmpty(emp.permanent_address_city)
        && nonEmpty(emp.permanent_address_state) && nonEmpty(emp.permanent_address_zip),
    },

    // Employment
    { id: 'department',         label: 'Department',                                          done: nonEmpty(emp.department) },
    { id: 'job_title',          label: 'Job title',                                           done: nonEmpty(emp.job_title) },
    { id: 'employment_type',    label: 'Employment type',                                     done: nonEmpty(emp.employment_type) },
    { id: 'start_date',         label: 'Start date',                                          done: nonEmpty(emp.start_date) },
    { id: 'work_location',      label: 'Work location',                                       done: nonEmpty(emp.work_location) },

    // Immigration — visa TYPE is required, the rest of the visa fields are not.
    // Everything about the document checklist hangs off visa_type: which
    // documents are mandatory, and which are even shown. With it blank the
    // required list silently collapses to the four universal documents, so an
    // employee could finish onboarding without ever being asked for their
    // passport, visa or I-94. Mirrors the 'visa_type' item in the frontend
    // checklist in src/portal/pages/NewEmployee.tsx.
    { id: 'visa_type',          label: 'Visa / Work Authorization Type',                      done: nonEmpty(emp.visa_type) },
    { id: 'ssn',                label: 'Social Security Number',                              done: /^\d{3}-\d{2}-\d{4}$/.test(String(emp.ssn ?? '')) },

    // Bank details — required for ACH direct deposit setup
    {
      id: 'bank',
      label: 'Bank details (name, account number, routing number)',
      done: nonEmpty(emp.bank_name) && nonEmpty(emp.bank_account_number) && nonEmpty(emp.bank_routing_number),
    },

    // Education — every entry must be complete, not just one (matches the
    // frontend wizard's isEducationSectionDone(); a single incomplete row
    // used to still count as "done" here, disagreeing with the wizard).
    {
      id: 'education',          label: 'Education (every entry has institution, level, and year)',
      done: education.length > 0 && education.every(e => nonEmpty(e?.institution) && nonEmpty(e?.level) && (nonEmpty(e?.passYear) || numPositive(e?.passYear))),
    },

    // Emergency contact (full address now required)
    {
      id: 'emergency',          label: 'Emergency contact (name, relationship, phone, address)',
      done: nonEmpty(emp.emergency_contact_name)
        && nonEmpty(emp.emergency_contact_relationship)
        && nonEmpty(emp.emergency_contact_phone)
        && nonEmpty(emp.emergency_contact_address)
        && nonEmpty(emp.emergency_contact_city)
        && nonEmpty(emp.emergency_contact_state)
        && nonEmpty(emp.emergency_contact_zip),
    },

    ...ONBOARDING_REQUIRED_DOCS.map(t => ({
      id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label: `${t} (upload required)`,
      // Also accept a doc's previous type string, so records uploaded before
      // a required-doc label was renamed (e.g. "Social Security Number" ->
      // "Social Security Card") still count as satisfied.
      done: docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias)),
    })),

    // Passport + I-94 — only required for visa types that would actually hold
    // them (see VISA_TYPES_REQUIRING_PASSPORT_I94 above). Also requires an
    // expiry date, matching the frontend wizard's equivalent check — without
    // this the backend gate disagreed with what the wizard itself demanded,
    // letting "Finish onboarding" pass with a doc on file but no expiry.
    ...(VISA_TYPES_REQUIRING_PASSPORT_I94.has(String(emp.visa_type ?? '')) ? VISA_CONDITIONAL_REQUIRED_DOCS.map(t => {
      const uploaded = docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias));
      const expiry = expiryFor(emp.identity_documents, EXPIRY_REQUIRED_DOC_KEYS[t]);
      return {
        id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: `${t} (upload required)`,
        done: uploaded && nonEmpty(expiry),
      };
    }) : []),

    // Visa-type-specific documents (I-9 / I-20 / EAD for OPT and STEM OPT, the
    // petition paperwork for Green Card). Those with an entry in
    // EXPIRY_REQUIRED_DOC_KEYS need an expiry date as well as an upload — the
    // wizard demands one for every required row with hasExpiry, and I-20, the
    // EAD and I-797 are among them. This block used to accept the upload
    // alone, which made the server gate weaker than the form the employee had
    // just filled in.
    // Skips anything already demanded above so a document cannot appear twice
    // in the missing list (Visa for STEM OPT, Passport for Green Card).
    ...((policyExtras ?? VISA_REQUIRED_EXTRA_DOCS[String(emp.visa_type ?? '')] ?? [])
      .filter(t => !(VISA_TYPES_REQUIRING_PASSPORT_I94.has(String(emp.visa_type ?? ''))
        && (VISA_CONDITIONAL_REQUIRED_DOCS as readonly string[]).includes(t)))
      .map(t => {
        const uploaded = docTypes.has(t) || (DOC_TYPE_LEGACY_ALIASES[t] ?? []).some(alias => docTypes.has(alias));
        const key = EXPIRY_REQUIRED_DOC_KEYS[t];
        const expiry = expiryFor(emp.identity_documents, key);
        return {
          id: `doc_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          label: `${t} (upload required)`,
          done: uploaded && (!key || nonEmpty(expiry)),
        };
      })),

    // The answered/unanswered optional documents, last so the required list
    // still reads first in the "missing" message.
    ...holdingChecks,
  ];

  const done = checks.filter(c => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    complete: done === checks.length,
    missing: checks.filter(c => !c.done).map(c => c.label),
    items: checks,
  };
}
