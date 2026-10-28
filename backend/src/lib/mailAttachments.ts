/**
 * How much we are willing to put in one email, and what to do with the rest.
 *
 * Invoices now carry their evidence: the generated PDF plus every
 * client-signed timesheet the invoice bills for. That is what makes the
 * invoice self-contained for the client's AP team, and it is the whole point
 * of attaching them.
 *
 * But it collides with the upload work. A client-signed proof may now be up to
 * 100 MB, and SES refuses a message over 40 MB — after MIME base64 inflates
 * every attachment by a third. One oversize scan would therefore fail the
 * entire invoice email, which is far worse than sending the invoice without
 * that one proof.
 *
 * So the budget is enforced here, before anything is read, and whatever does
 * not fit is reported rather than dropped: the caller lists the omissions in
 * the email body with a note to ask for them. A silently missing proof is the
 * failure mode worth avoiding — the client's AP team cannot chase a file they
 * do not know existed.
 *
 * Import-free on purpose, like uploadLimits.ts, so tests can load it without
 * dragging in config/env.
 */

/** 40 MB SES ceiling, minus base64's 4/3 inflation and room for the HTML body. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/**
 * No single attachment may take more than this.
 *
 * Deliberately well under the total: one 19 MB scan would otherwise consume
 * the whole budget and push out every other proof, which reads to the client
 * as "they sent one random timesheet".
 */
export const MAX_SINGLE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export interface SizedAttachment {
  filename: string;
  bytes: number;
}

export type OmissionReason = 'too-large' | 'budget-full';

export interface AttachmentPlan<T extends SizedAttachment> {
  attach: T[];
  omitted: Array<{ item: T; reason: OmissionReason }>;
  totalBytes: number;
}

/**
 * Decide what fits, in the order given.
 *
 * Order is the caller's responsibility and it matters: the invoice PDF goes
 * first because an invoice email without the invoice is pointless, then the
 * proofs in line order so what arrives matches what the client reads down the
 * page.
 *
 * Nothing is re-ordered to pack the budget more efficiently. Fitting a small
 * proof from week 8 in place of a larger one from week 2 would produce an
 * arbitrary-looking subset; a prefix of the expected order is easier to
 * explain and to reconcile against the invoice lines.
 */
export function planAttachments<T extends SizedAttachment>(
  items: T[],
  limits: { totalBytes?: number; singleBytes?: number } = {},
): AttachmentPlan<T> {
  const totalCap = limits.totalBytes ?? MAX_TOTAL_ATTACHMENT_BYTES;
  const singleCap = limits.singleBytes ?? MAX_SINGLE_ATTACHMENT_BYTES;

  const attach: T[] = [];
  const omitted: Array<{ item: T; reason: OmissionReason }> = [];
  let used = 0;

  for (const item of items) {
    if (item.bytes > singleCap) {
      omitted.push({ item, reason: 'too-large' });
      continue;
    }
    if (used + item.bytes > totalCap) {
      // Keep scanning rather than stopping: a later, smaller proof may still
      // fit, and including it is strictly better for the client.
      omitted.push({ item, reason: 'budget-full' });
      continue;
    }
    attach.push(item);
    used += item.bytes;
  }

  return { attach, omitted, totalBytes: used };
}

/**
 * One line for the email body naming what was left out.
 *
 * Returns null when everything fitted, so the caller can omit the paragraph
 * entirely rather than print "0 attachments were omitted".
 */
export function describeOmissions<T extends SizedAttachment>(
  omitted: Array<{ item: T; reason: OmissionReason }>,
): string | null {
  if (omitted.length === 0) return null;
  const names = omitted.map(o => o.item.filename).join(', ');
  return omitted.length === 1
    ? `One supporting document was too large to attach (${names}). Please ask us for it and we will send it separately.`
    : `${omitted.length} supporting documents were too large to attach (${names}). Please ask us for them and we will send them separately.`;
}
