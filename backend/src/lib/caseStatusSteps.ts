// Single source of truth for the 11-step case status timeline. One fixed
// list for every case type (per explicit decision — not tailored per case
// type). Additive to the existing coarse `case_status` enum — the two are
// intentionally independent, no auto-derivation between them.
export const CASE_STATUS_STEPS = [
  { key: 'started', order: 1, label: 'Started' },
  { key: 'beneficiary_questionnaire', order: 2, label: 'Beneficiary Questionnaire' },
  { key: 'petitioner_reviewed', order: 3, label: 'Petitioner Reviewed' },
  { key: 'forms_letters_generated', order: 4, label: 'Forms & Letters Generated' },
  { key: 'paralegal_review', order: 5, label: 'Paralegal Review' },
  { key: 'forms_sent_for_signatures', order: 6, label: 'Forms Sent for Signatures' },
  { key: 'received_signed_forms', order: 7, label: 'Received Signed Forms' },
  { key: 'supervisor_review', order: 8, label: 'Supervisor Review' },
  { key: 'submitted_to_uscis', order: 9, label: 'Submitted to USCIS' },
  { key: 'receipt_received', order: 10, label: 'Receipt Received' },
  { key: 'uscis_response', order: 11, label: 'USCIS Response' },
] as const;

export type CaseStatusStepKey = typeof CASE_STATUS_STEPS[number]['key'];

export function isValidCaseStatusStepKey(value: unknown): value is CaseStatusStepKey {
  return typeof value === 'string' && CASE_STATUS_STEPS.some(s => s.key === value);
}
