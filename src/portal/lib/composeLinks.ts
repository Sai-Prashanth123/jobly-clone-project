/**
 * Compose-link builders for "Send via Gmail / Outlook / default mail app".
 *
 * NOTE: web compose deep links (and mailto:) can prefill to/subject/body only —
 * they CANNOT attach a file or carry HTML. So the body is plain text and the
 * invoice PDF is delivered as (a) a link to the public invoice page and (b) a
 * separate browser download the user attaches manually. This matches what every
 * invoicing tool can do without an OAuth mailbox integration.
 */

export interface ComposeParams {
  to: string;
  subject: string;
  body: string;
}

const enc = encodeURIComponent;

/** Gmail web compose (works for the user's signed-in Google account). */
export function buildGmailLink({ to, subject, body }: ComposeParams): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
}

/** Outlook web compose — Microsoft 365 (work/school). */
export function buildOutlookLink({ to, subject, body }: ComposeParams): string {
  return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
}

/** Outlook web compose — personal Outlook.com / Hotmail accounts. */
export function buildOutlookLiveLink({ to, subject, body }: ComposeParams): string {
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
}

/** Default desktop mail client. */
export function buildMailtoLink({ to, subject, body }: ComposeParams): string {
  return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** Public, no-auth invoice view page for a token (clients open this in a browser). */
export function publicInvoiceUrl(publicToken: string): string {
  return `${window.location.origin}/portal/i/${publicToken}`;
}

/**
 * Build the plain-text email body. Includes the public invoice link (so the
 * client can view/pay even if the user forgets to attach the PDF) and a note
 * that a PDF copy was downloaded to attach.
 */
export function buildInvoiceEmailBody(opts: {
  contactName: string;
  message: string;
  publicUrl?: string;
  withPdfNote?: boolean;
}): string {
  const lines = [`Hi ${opts.contactName || 'there'},`, '', opts.message.trim()];
  if (opts.publicUrl) {
    lines.push('', `View & pay your invoice online: ${opts.publicUrl}`);
  }
  if (opts.withPdfNote) {
    lines.push('', '(A PDF copy has been downloaded for you to attach to this email.)');
  }
  lines.push('', 'Thank you,', 'Jobly Solutions');
  return lines.join('\n');
}
