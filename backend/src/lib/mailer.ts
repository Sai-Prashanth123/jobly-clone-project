import { EmailClient, KnownEmailSendStatus, type EmailMessage } from '@azure/communication-email';
import { formatDateSafe } from './dateUtils';
import { getJoblyLogoBuffer } from './joblyLogo';

// HTML-escape any user-supplied string before it lands in an email body.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// Azure Communication Services Email transport.
// Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.
// ACS_SENDER_ADDRESS is pre-configured to the Azure-managed domain provisioned
// during setup; override with ACS_SENDER_ADDRESS env var if domain changes.
const ACS_CONNECTION_STRING = process.env.AZURE_COMM_CONNECTION_STRING?.trim();
const ACS_SENDER = (process.env.ACS_SENDER_ADDRESS?.trim())
  || 'DoNotReply@1dab9ceb-3c53-4e33-a4b1-c00cedde4e29.azurecomm.net';

export const mailerConfigured = !!ACS_CONNECTION_STRING;

let _acsClient: EmailClient | null = null;
function getAcsClient(): EmailClient {
  if (!_acsClient) {
    if (!ACS_CONNECTION_STRING) throw new Error('AZURE_COMM_CONNECTION_STRING is not configured. Set it in Azure App Settings.');
    _acsClient = new EmailClient(ACS_CONNECTION_STRING);
  }
  return _acsClient;
}

function toAcsRecipients(to: string | string[]): { address: string }[] {
  return (Array.isArray(to) ? to : [to]).map(a => ({ address: a.trim() })).filter(r => r.address);
}

// Nodemailer-compatible send interface so all callers keep the same signature.
// CID (inline) attachments are silently skipped — embed images as data URIs in HTML instead.
interface MailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
    contentDisposition?: string;
  }>;
}

async function sendWithRetry(mail: MailOptions): Promise<void> {
  if (!ACS_CONNECTION_STRING) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const client = getAcsClient();
  const acsAttachments = (mail.attachments ?? [])
    .filter(a => !a.cid && a.content)
    .map(a => ({
      name: a.filename,
      contentType: a.contentType ?? 'application/octet-stream',
      contentInBase64: a.content!.toString('base64'),
    }));

  // Build content with at least one body field (ACS requires html or plainText).
  const rawContent = { subject: mail.subject, html: mail.html, plainText: mail.text };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = rawContent as any as EmailMessage['content'];

  const message: EmailMessage = {
    senderAddress: ACS_SENDER,
    recipients: { to: toAcsRecipients(mail.to) },
    content,
    replyTo: mail.replyTo ? [{ address: mail.replyTo }] : undefined,
    attachments: acsAttachments.length ? acsAttachments : undefined,
  };

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (result.status !== KnownEmailSendStatus.Succeeded) {
      throw new Error(`Azure email send failed: ${result.error?.message ?? result.status}`);
    }
    console.log(`[mailer] ✓ Email sent to ${JSON.stringify(mail.to)} subject="${mail.subject}"`);
  } catch (err: any) {
    console.error(`[mailer] ✗ Email to ${JSON.stringify(mail.to)} failed: ${err?.message ?? err}`);
    throw err;
  }
}

const FROM = ACS_SENDER;
const PORTAL_URL = process.env.FRONTEND_URL ?? 'https://yellow-sea-0a9088500.6.azurestaticapps.net';

export async function verifyMailer(): Promise<void> {
  if (!mailerConfigured) {
    console.warn('[mailer] AZURE_COMM_CONNECTION_STRING not set — email is disabled. Add it to Azure App Settings.');
    return;
  }
  console.log(`[mailer] ✓ Azure Communication Email configured; sending as "${ACS_SENDER}"`);
}

export interface WelcomeEmailPayload {
  to: string | string[];
  firstName: string;
  lastName: string;
  displayId?: string;
  jobTitle?: string;
  department?: string;
  startDate?: string;
  workLocation?: string;
  employmentType?: string;
  paymentType?: string;
  loginEmail?: string;
  tempPassword?: string;
  // Info-only variants (resending after the user has set their OWN password, or
  // a login-email-changed notice) omit the temp password entirely so we never
  // re-surface / overwrite a credential the user controls. `subject`/`bodyIntro`
  // tailor the copy without needing a separate template.
  subject?: string;
  bodyIntro?: string;
}

export async function sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
  const {
    to, firstName, lastName, displayId,
    jobTitle, department, startDate, workLocation, employmentType, paymentType,
    loginEmail, tempPassword, subject, bodyIntro,
  } = payload;

  // Credentialed welcome only when a temp password is actually being issued.
  const showCreds = !!(loginEmail && tempPassword);

  const rows = [
    displayId     ? ['Employee ID', displayId]            : null,
    jobTitle      ? ['Job Title', jobTitle]               : null,
    department    ? ['Department', department]             : null,
    startDate     ? ['Start Date', startDate]              : null,
    workLocation  ? ['Work Location', workLocation]        : null,
    employmentType? ['Employment Type', employmentType.toUpperCase()] : null,
    paymentType   ? ['Payment Type', paymentType.toUpperCase()]       : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${esc(label)}</td>
        <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:500;border-bottom:1px solid #f3f4f6;">${esc(value)}</td>
      </tr>`)
    .join('');

  const intro = bodyIntro ?? (showCreds
    ? 'Welcome aboard! HR has added you to the Jobly Workforce Portal. Below are your onboarding details and your temporary login credentials &mdash; please log in and change your password right away.'
    : 'Your Jobly Workforce Portal account is active. Use the button below to log in. If you ever forget your password, use &ldquo;Forgot password?&rdquo; on the login page.');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4069FF,#32CDDC);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome to Jobly Portal</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${showCreds ? 'Your employee account is ready' : 'Account update'}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">Hi <strong>${esc(firstName)} ${esc(lastName)}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              ${intro}
            </p>

            ${rows.length ? `
            <!-- Details table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th colspan="2" style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">
                    Your Details
                  </th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            ` : ''}

            ${showCreds ? `
            <!-- Login credentials -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #4069FF;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <thead>
                <tr style="background:#4069FF;">
                  <th colspan="2" style="padding:10px 16px;text-align:left;font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">
                    🔐 Your Login Credentials
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;width:40%;">Company</td>
                  <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">Jobly Solutions</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">Username / Email</td>
                  <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;font-family:monospace;border-bottom:1px solid #e5e7eb;">${esc(loginEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Temporary Password</td>
                  <td style="padding:12px 16px;font-size:15px;font-weight:700;font-family:monospace;letter-spacing:2px;color:#4069FF;">${esc(tempPassword)}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin:0 0 24px;color:#dc2626;font-size:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
              ⚠️ This is a one-time temporary password. You'll be asked to set your own password the first time you log in.
            </p>
            ` : (loginEmail ? `
            <!-- Login email (no password) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <tbody>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;width:40%;">Login Email</td>
                  <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;font-family:monospace;">${esc(loginEmail)}</td>
                </tr>
              </tbody>
            </table>
            ` : '')}

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${esc(PORTAL_URL)}/portal/login"
                     style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                    Log In to Jobly Portal →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
              If you have any questions about your onboarding, please reach out to your HR team.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Jobly Solutions · Workforce Management Portal
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  await sendWithRetry({
    from: FROM,
    to,
    subject: subject ?? (showCreds ? `Welcome to Jobly Portal — ${displayId ?? ''}` : 'Your Jobly Portal account'),
    html,
  });
}

export interface InvoiceEmailPayload {
  to: string;
  clientName: string;
  contactName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  subtotal: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  pdfUrl?: string;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
  notes?: string;
  terms?: string;
  lineItems: { itemName?: string; description: string; quantity: number; unitPrice: number; amount: number; isHours?: boolean }[];
  attachmentFiles?: { filename: string; content: Buffer; contentType?: string }[];
}

export async function sendInvoiceEmail(payload: InvoiceEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const logoDataUri = `data:image/png;base64,${getJoblyLogoBuffer().toString('base64')}`;
  const {
    to, clientName, contactName, invoiceNumber,
    issueDate, dueDate, currency, subtotal, discountType, discountValue, discountAmount,
    taxRate, taxAmount, totalAmount, amountPaid, balanceDue,
    billingPeriodStart, billingPeriodEnd, pdfUrl, pdfBuffer, pdfFileName, notes, terms, lineItems,
  } = payload;

  // Currency-aware; guard against a bad/legacy code (Intl throws) → USD.
  let cf: Intl.NumberFormat;
  try { cf = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }); }
  catch { cf = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
  const fmt = (n: number) => cf.format(Number(n) || 0);
  const fmtDate = (s: string) => formatDateSafe(s, { long: true }) || s;

  const allHours = lineItems.length > 0 && lineItems.every(li => li.isHours);
  const qtyHeader = allHours ? 'Hours' : 'Qty';
  const priceHeader = allHours ? 'Rate' : 'Unit price';

  const lineRows = lineItems.map(li => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${li.itemName ? `<strong>${esc(li.itemName)}</strong><br><span style="color:#6b7280;font-size:12px;">${esc(li.description)}</span>` : esc(li.description)}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${esc(li.quantity)}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(li.unitPrice)}${li.isHours ? '/hr' : ''}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(li.amount)}</td>
    </tr>`).join('');

  const discountRow = discountAmount && discountAmount > 0 ? `<tr>
                <td style="padding:6px 16px;font-size:13px;color:#6b7280;">Discount${discountType === 'percentage' && discountValue ? ` (${esc(discountValue)}%)` : ''}</td>
                <td style="padding:6px 16px;font-size:13px;color:#111827;text-align:right;">−${fmt(discountAmount)}</td>
              </tr>` : '';
  const taxRow = taxRate > 0 ? `<tr>
                <td style="padding:6px 16px;font-size:13px;color:#6b7280;">Tax (${esc(taxRate)}%)</td>
                <td style="padding:6px 16px;font-size:13px;color:#111827;text-align:right;">${fmt(taxAmount)}</td>
              </tr>` : '';
  const paidRows = amountPaid && amountPaid > 0 ? `<tr>
                <td style="padding:6px 16px;font-size:13px;color:#059669;">Amount paid</td>
                <td style="padding:6px 16px;font-size:13px;color:#059669;text-align:right;">−${fmt(amountPaid)}</td>
              </tr>
              <tr>
                <td style="padding:6px 16px;font-size:13px;font-weight:700;color:#111827;">Balance due</td>
                <td style="padding:6px 16px;font-size:13px;font-weight:700;color:#111827;text-align:right;">${fmt(balanceDue ?? (totalAmount - amountPaid))}</td>
              </tr>` : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#ffffff;padding:26px 40px 6px;">
            <img src="${logoDataUri}" alt="Jobly Solutions" height="40" style="display:block;border:0;outline:none;text-decoration:none;height:40px;width:auto;">
          </td>
        </tr>
        <tr>
          <td style="background:linear-gradient(135deg,#2563EB,#0F2942);padding:26px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Invoice from Jobly Solutions</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${esc(invoiceNumber)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${esc(contactName)}</strong>,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.6;">
              Please find your invoice <strong>attached as a PDF</strong> for services rendered to <strong>${esc(clientName)}</strong>.
              ${billingPeriodStart && billingPeriodEnd ? `Billing period: <strong>${esc(fmtDate(billingPeriodStart))}</strong> to <strong>${esc(fmtDate(billingPeriodEnd))}</strong>.` : ''}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Description</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">${qtyHeader}</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">${priceHeader}</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Amount</th>
                </tr>
              </thead>
              <tbody>${lineRows}</tbody>
            </table>

            <table align="right" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:6px 16px;font-size:13px;color:#6b7280;">Subtotal</td>
                <td style="padding:6px 16px;font-size:13px;color:#111827;text-align:right;">${fmt(subtotal)}</td>
              </tr>
              ${discountRow}
              ${taxRow}
              <tr style="background:#f9fafb;">
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#111827;border-top:2px solid #e5e7eb;">Total</td>
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#2563EB;border-top:2px solid #e5e7eb;text-align:right;">${fmt(totalAmount)}</td>
              </tr>
              ${paidRows}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:40%;">Issue Date</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #f3f4f6;">${esc(fmtDate(issueDate))}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6b7280;">Payment Due</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#dc2626;">${esc(fmtDate(dueDate))}</td>
              </tr>
            </table>

            ${notes ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #2563EB;padding:12px 16px;border-radius:4px;">${esc(notes)}</p>` : ''}
            ${terms ? `<p style="margin:0 0 24px;font-size:12px;color:#9ca3af;line-height:1.6;">${esc(terms)}</p>` : ''}

            ${pdfUrl ? `<table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${esc(pdfUrl)}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                  Download Invoice PDF →
                </a>
              </td></tr>
            </table>` : ''}

            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
              Please remit payment by the due date. For billing inquiries, contact billing@joblysolutions.com.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Jobly Solutions · Workforce Management Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Build attachments: invoice PDF + any uploaded docs (PSL.pdf etc.)
  const attachments: MailOptions['attachments'] = [];
  if (pdfBuffer) {
    attachments.push({
      filename: pdfFileName ?? `${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }
  if (payload.attachmentFiles) {
    for (const f of payload.attachmentFiles) {
      attachments.push({ filename: f.filename, content: f.content, contentType: f.contentType });
    }
  }

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Invoice ${invoiceNumber} from Jobly Solutions — Due ${fmtDate(dueDate)}`,
    html,
    attachments,
  });
}

// ── Generic / template emails (Finance "Email clients" blast) ─────────────────

// Replace {{placeholder}} tokens with per-recipient values. Unknown tokens
// resolve to '' so a literal {{x}} never reaches the recipient.
export function renderTemplate(html: string, vars: Record<string, string>): string {
  return (html || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => vars[key.toLowerCase()] ?? '');
}

// Wrap finance-authored header/body/footer HTML into the branded email shell.
// The header/body/footer must already be sanitized + placeholder-rendered.
export function buildBrandedEmail(parts: { headerHtml?: string; bodyHtml: string; footerHtml?: string }): string {
  const { headerHtml = '', bodyHtml, footerHtml = '' } = parts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#2563EB,#0F2942);padding:28px 40px;color:#ffffff;">
            <div style="font-size:20px;font-weight:700;">Jobly Solutions</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);">Workforce Management</div>
          </td>
        </tr>
        <tr><td style="padding:32px 40px;color:#374151;font-size:14px;line-height:1.6;">
          ${headerHtml ? `<div style="margin-bottom:16px;color:#0F2942;">${headerHtml}</div>` : ''}
          <div>${bodyHtml}</div>
          ${footerHtml ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${footerHtml}</div>` : ''}
        </td></tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface CustomEmailPayload { to: string | string[]; subject: string; html: string }

// Send a fully-rendered custom email (used by the bulk client mailer).
export async function sendCustomEmail(payload: CustomEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  await sendWithRetry({ from: FROM, to: payload.to, subject: payload.subject, html: payload.html });
}

// ── Public website contact form ──────────────────────────────────────────────
// Where landing-page "Contact Us" submissions are delivered.
const CONTACT_TO = process.env.CONTACT_TO?.trim() || 'info@joblysolutions.com';

export interface ContactFormPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export async function sendContactEmail(p: ContactFormPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:120px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 16px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${value}</td>
    </tr>`;
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <tr><td style="background:linear-gradient(135deg,#2563EB,#0F2942);padding:24px 32px;color:#ffffff;">
        <div style="font-size:18px;font-weight:700;">New contact-form message</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.85);">joblysolutions.com — Contact Us</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${row('Name', esc(p.name))}
          ${row('Email', `<a href="mailto:${esc(p.email)}" style="color:#2563EB;">${esc(p.email)}</a>`)}
          ${p.phone ? row('Phone', esc(p.phone)) : ''}
          ${p.subject ? row('Subject', esc(p.subject)) : ''}
        </table>
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Message</div>
        <div style="font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;background:#f9fafb;border-left:3px solid #2563EB;padding:12px 16px;border-radius:4px;">${esc(p.message)}</div>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Reply directly to this email to respond to ${esc(p.name)}.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await sendWithRetry({
    from: FROM,
    to: CONTACT_TO,
    replyTo: p.email,
    subject: `New contact message${p.subject ? `: ${p.subject}` : ''} — from ${p.name}`,
    html,
  });
}

// Scheduled payment reminder. `tone` shapes the copy: upcoming (before due),
// due (on due date), overdue (after due).
export async function sendInvoiceReminderEmail(payload: {
  to: string; contactName: string; invoiceNumber: string; dueDate: string;
  balanceDue: number; currency?: string; tone: 'upcoming' | 'due' | 'overdue'; viewUrl?: string;
}): Promise<void> {
  if (!mailerConfigured) throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: payload.currency || 'USD' }).format(n);
  const fmtDate = (s: string) => formatDateSafe(s, { long: true }) || s;
  const headline = payload.tone === 'overdue'
    ? `Payment overdue — Invoice ${payload.invoiceNumber}`
    : payload.tone === 'due'
      ? `Payment due today — Invoice ${payload.invoiceNumber}`
      : `Payment reminder — Invoice ${payload.invoiceNumber}`;
  const intro = payload.tone === 'overdue'
    ? `This is a friendly reminder that invoice <strong>${esc(payload.invoiceNumber)}</strong> is past due (was due ${fmtDate(payload.dueDate)}).`
    : payload.tone === 'due'
      ? `Invoice <strong>${esc(payload.invoiceNumber)}</strong> is due today, ${fmtDate(payload.dueDate)}.`
      : `Invoice <strong>${esc(payload.invoiceNumber)}</strong> is due on ${fmtDate(payload.dueDate)}.`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1220;">
      <h2 style="margin:0 0 12px;">${esc(headline)}</h2>
      <p style="margin:0 0 8px;">Hi ${esc(payload.contactName || 'there')},</p>
      <p style="margin:0 0 12px;line-height:1.5;">${intro}</p>
      <p style="margin:0 0 16px;font-size:18px;"><strong>Balance due: ${fmt(payload.balanceDue)}</strong></p>
      ${payload.viewUrl ? `<p style="margin:0 0 16px;"><a href="${esc(payload.viewUrl)}" style="background:#4069FF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;">View invoice</a></p>` : ''}
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">Thank you — Jobly Solutions</p>
    </div>`;
  await sendWithRetry({
    from: FROM,
    to: payload.to,
    subject: headline,
    html,
  });
}

export interface MonthlyTimesheetEmailPayload {
  to: string | string[];
  employeeName: string;
  employeeDisplayId: string;
  department?: string;
  monthLabel: string;
  totalHours: number;
  expectedHours: number;
  balance: number;
  workingDays: number;
  leaveDays: number;
  status: string;
  pdfUrl?: string;
  rows: { date: string; day: string; project: string; task: string; start: string; end: string; hours: number; status: string }[];
}

export async function sendMonthlyTimesheetEmail(payload: MonthlyTimesheetEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const {
    to, employeeName, employeeDisplayId, department, monthLabel,
    totalHours, expectedHours, balance, workingDays, leaveDays, status, pdfUrl, rows,
  } = payload;

  const fmtH = (n: number) => (Number(n) || 0).toFixed(1);
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  const summaryCell = (label: string, value: string, color = '#111827') => `
    <td style="padding:12px 14px;border:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">${esc(label)}</div>
      <div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;">${esc(value)}</div>
    </td>`;

  const lineRows = rows.map(r => `
    <tr>
      <td style="padding:7px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${esc(r.date)}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${esc(r.day)}</td>
      <td style="padding:7px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${esc(r.project || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${esc(r.task || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;text-align:center;">${esc(r.start || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;text-align:center;">${esc(r.end || '—')}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;text-align:center;">${r.hours > 0 ? fmtH(r.hours) : '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6;text-align:center;">${esc(cap(r.status))}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#4069FF,#32CDDC);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Monthly Timesheet — ${esc(monthLabel)}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${esc(employeeName)} · ${esc(employeeDisplayId)}${department ? ` · ${esc(department)}` : ''}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${esc(employeeName)}</strong> submitted their attendance timesheet for <strong>${esc(monthLabel)}</strong>. Summary below; the full PDF is attached via the button.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tr>
                ${summaryCell('Total Hours', fmtH(totalHours), '#4069FF')}
                ${summaryCell('Expected', fmtH(expectedHours), '#d97706')}
                ${summaryCell('Balance', `${balance >= 0 ? '+' : ''}${fmtH(balance)}`, balance >= 0 ? '#059669' : '#dc2626')}
                ${summaryCell('Working Days', String(workingDays))}
                ${summaryCell('Leave Days', String(leaveDays))}
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Date</th>
                  <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Day</th>
                  <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Project</th>
                  <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Task</th>
                  <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Start</th>
                  <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">End</th>
                  <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Hours</th>
                  <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Status</th>
                </tr>
              </thead>
              <tbody>${lineRows}</tbody>
            </table>

            ${pdfUrl ? `<table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:4px 0 16px;">
                <a href="${esc(pdfUrl)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                  Download Timesheet PDF →
                </a>
              </td></tr>
            </table>` : ''}

            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
              Review this timesheet in the Jobly Portal under <strong>Attendance Review</strong>. Current status: <strong>${esc(cap(status))}</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Jobly Solutions · Workforce Management Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Monthly Timesheet — ${employeeName} (${employeeDisplayId}) — ${monthLabel}`,
    html,
  });
}

export interface OnboardingCompletedEmailPayload {
  to: string | string[];
  employeeName: string;
  displayId: string;
  department?: string;
  jobTitle?: string;
  completedAt: string;
  detailUrl?: string;
}

// Sent to HR + admin when an employee submits self-onboarding for review. The
// employee stays in 'onboarding' until HR opens their profile and approves.
export async function sendOnboardingCompletedEmail(payload: OnboardingCompletedEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const { to, employeeName, displayId, department, jobTitle, completedAt, detailUrl } = payload;
  const when = formatDateSafe(completedAt, { long: true }) || completedAt;
  const link = detailUrl || `${PORTAL_URL}/portal/employees`;

  const rows = [
    ['Employee', `${employeeName} (${displayId})`],
    jobTitle   ? ['Job Title', jobTitle]   : null,
    department ? ['Department', department] : null,
    ['Completed', when],
  ].filter(Boolean) as [string, string][];

  const tableRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;width:38%;">${esc(label)}</td>
        <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:500;border-bottom:1px solid #f3f4f6;">${esc(value)}</td>
      </tr>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#4069FF,#32CDDC);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Onboarding Submitted for Review</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">An employee is awaiting your review</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${esc(employeeName)}</strong> has submitted their onboarding paperwork and is <strong>awaiting HR review</strong>. Open their profile, review the details and documents, then click <strong>Approve Onboarding</strong> to activate their account.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <tbody>${tableRows}</tbody>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 8px;">
                  <a href="${esc(link)}"
                     style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                    Review &amp; Approve →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Jobly Solutions · Workforce Management Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Onboarding submitted — ${employeeName} (${displayId}) awaiting review`,
    html,
  });
}

export interface OnboardingChangesRequestedEmailPayload {
  to: string | string[];
  employeeName: string;
  displayId: string;
  message: string;       // HR's freeform message to the employee
  portalUrl?: string;    // Deep link to /portal/onboarding/pending
}

// Sent to the employee when HR clicks "Request Changes" on their submitted
// onboarding. The pending-review screen surfaces the same message in-app; this
// email duplicates it so the employee notices even if they're not logged in.
export async function sendOnboardingChangesRequestedEmail(
  payload: OnboardingChangesRequestedEmailPayload,
): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const { to, employeeName, displayId, message, portalUrl } = payload;
  const link = portalUrl || `${PORTAL_URL}/portal/onboarding/pending`;

  // Render the message with paragraph breaks preserved.
  const messageHtml = esc(message).replace(/\n/g, '<br>');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#fb923c);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Onboarding — changes requested</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.92);font-size:14px;">Please review HR's notes and update your information</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi <strong>${esc(employeeName)}</strong>,</p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
              HR has reviewed your onboarding submission for <strong>${esc(displayId)}</strong> and asked for a few changes before they can approve.
              Their note is below — please log in to the portal, update your information, and resubmit.
            </p>

            <div style="margin:0 0 24px;padding:16px 18px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-size:14px;line-height:1.55;">
              ${messageHtml}
            </div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 8px;">
                  <a href="${esc(link)}"
                     style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                    Update my information →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:18px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
              If you have questions about what to change, reach out to your HR team directly.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Jobly Solutions · Workforce Management Portal</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Onboarding — changes requested for ${employeeName} (${displayId})`,
    html,
  });
}

// Diagnostic smoke-test — sends a plain-text email to the given address so an
// admin can confirm the SMTP transport is working end-to-end from the portal.
export async function testEmailDelivery(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendWithRetry({
      from: FROM,
      to,
      subject: 'Jobly Email Test',
      text: 'This is a test email from Jobly. If you received this, email delivery is working.',
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}
