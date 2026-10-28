/**
 * The address customers see on anything to do with money.
 *
 * `billing@joblysolutions.com` was hardcoded in five separate places — the
 * invoice email footer, the branded email shell, the reminder footer, and both
 * the header and footer of the generated PDF — plus seeded into
 * `invoice_templates.footer_text` rows and a Zod default. Changing it meant
 * finding all of them, which is exactly the duplication that has caused most
 * of this project's drift bugs.
 *
 * Finance asked for `ap@`. One constant now, env-overridable so it can be
 * changed without a deploy, with the agreed value as the code default so no
 * infrastructure change is needed to ship it.
 *
 * NOTE: sending *from* this address works because the whole
 * joblysolutions.com domain is a verified SES identity — the mailbox itself
 * does not have to exist for SES to accept the send. Replies, however, go to a
 * real mailbox, so `ap@` must exist on the mail server or they will bounce.
 */
export const BILLING_EMAIL = process.env.BILLING_EMAIL?.trim() || 'ap@joblysolutions.com';

/** Sender for invoice mail: a display name customers recognise, not "Jobly Portal". */
export const BILLING_FROM = `Jobly Solutions <${BILLING_EMAIL}>`;

/**
 * The sign-off customers read at the bottom of every invoice.
 *
 * Deliberately separate from BILLING_FOOTER and from invoice_templates.footer_text:
 * that one is the contact line and an admin may replace it per template, which
 * would silently take the thank-you with it. This line always appears.
 */
export const INVOICE_THANK_YOU = 'Thank you for your business!! Jobly Solutions~';

/** The one-line footer shown under invoices, in email and on the PDF. */
export const BILLING_FOOTER = `Jobly Solutions · ${BILLING_EMAIL} · www.joblysolutions.com`;
