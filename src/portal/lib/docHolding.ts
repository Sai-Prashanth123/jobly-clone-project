import type { IdentityDocumentEntry } from '../types';
import { EMPLOYER_DOC_ROWS } from './documentTypes';

/**
 * "Do you have this?" — who gets asked, and what an answer may do.
 *
 * Jagan's request was for a Yes/No so a person could opt out of a document
 * that does not apply to them. The decision rules were four inline expressions
 * inside a 3,000-line component, the answer was held in component state, and
 * it was dropped from the submit payload — so it was asked afresh on every
 * visit and shown on exactly one screen.
 *
 * The rules are here so they can be tested directly, and because one of them
 * is a safety property rather than a preference: a required document must never
 * be answerable, or somebody finishes onboarding without a document the company
 * is legally required to hold.
 */

export type HoldingAnswer = 'yes' | 'no';

/**
 * What the row offers.
 *  - 'required' → no choice at all; show the marker saying why.
 *  - 'ask'      → the Yes/No pair.
 *  - 'none'     → neither, for documents the employer issues.
 */
export type HoldingSlot = 'required' | 'ask' | 'none';

export function isEmployerManagedRow(rowType: string): boolean {
  return EMPLOYER_DOC_ROWS.some(r => r.type === rowType);
}

/**
 * Asking about a required document would be offering a choice that cannot be
 * honoured; asking about an employer-issued one would be asking the employee
 * about paperwork the company produces. Everything else is optional, and
 * optional is exactly the case the Yes/No exists for.
 */
export function holdingSlotFor(opts: { required: boolean; employerManaged: boolean }): HoldingSlot {
  if (opts.required) return 'required';
  if (opts.employerManaged) return 'none';
  return 'ask';
}

/**
 * The answer to show. A document already on file reads as "yes" without
 * anybody having said so — the alternative is a row with a copy attached and
 * no answer selected, which looks like an unanswered question.
 */
export function effectiveHolding(
  stored: HoldingAnswer | undefined,
  opts: { slot: HoldingSlot; hasFileOrUpload: boolean },
): HoldingAnswer | undefined {
  if (opts.slot !== 'ask') return undefined;
  if (stored) return stored;
  return opts.hasFileOrUpload ? 'yes' : undefined;
}

/**
 * Should the upload control, number, state and expiry be hidden?
 *
 * ALWAYS FALSE FOR A REQUIRED ROW, whatever the answer says. This is the
 * structural half of the guarantee that a "no" cannot satisfy a requirement:
 * even a stored answer on a row that has since become required leaves the
 * upload in place.
 */
export function hidesUpload(slot: HoldingSlot, answer: HoldingAnswer | undefined): boolean {
  return slot === 'ask' && answer !== 'yes';
}

/**
 * Which identity rows to persist, and with what.
 *
 * Replaces a filter that kept only rows carrying a number, state or expiry —
 * so a bare "no" had nothing in it and was silently dropped, which is why the
 * answer never survived a reload.
 *
 * `held` is stripped from any row that is required or not visible for the
 * current work status, so changing someone's visa type cannot leave an opt-out
 * behind on a document that now matters. Combined with `hidesUpload` above and
 * the fact that nothing in the onboarding gate reads `held` at all, that makes
 * three independent reasons a "no" cannot satisfy a requirement.
 */
export function identityDocsForPersist(
  entries: IdentityDocumentEntry[],
  requiredTypes: string[],
  isVisible: (rowType: string) => boolean,
): IdentityDocumentEntry[] {
  const required = new Set(requiredTypes);
  const out: IdentityDocumentEntry[] = [];

  for (const entry of entries ?? []) {
    const hasDetail =
      (entry.expiry ?? '').trim() !== '' ||
      (entry.number ?? '').trim() !== '' ||
      (entry.state ?? '').trim() !== '';

    const mayKeepAnswer =
      !!entry.held && !required.has(entry.type) && isVisible(entry.type);

    if (!hasDetail && !mayKeepAnswer) continue;

    if (mayKeepAnswer) {
      out.push(entry);
    } else {
      // Keep the details, drop an answer that is no longer allowed to exist.
      const { held: _dropped, ...rest } = entry;
      out.push(rest);
    }
  }

  return out;
}
