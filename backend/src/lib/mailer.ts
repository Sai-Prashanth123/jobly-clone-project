import { EmailClient, KnownEmailSendStatus, type EmailMessage } from '@azure/communication-email';
import { formatDateSafe, formatDateUS } from './dateUtils';
import { getJoblyLogoBuffer } from './joblyLogo';

// HTML-escape any user-supplied string before it lands in an email body.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// ── Shared email shell ───────────────────────────────────────────────────────
// Clean, light design: real Jobly logo, brand-blue accent border, white card.
// `body` is trusted HTML — callers must use esc() on any user data inside it.
function emailShell(opts: {
  previewText: string;
  title: string;
  subtitle: string;
  body: string;
}): string {
  const { previewText, title, subtitle, body } = opts;
  const logoSrc = `${PORTAL_URL}/assets/img/logo/logo-3.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f2f5;">${esc(previewText)}&nbsp;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f2f5;padding:36px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

  <!-- Logo bar -->
  <tr><td style="background:#ffffff;border-radius:12px 12px 0 0;padding:20px 40px;border-bottom:3px solid #4069FF;">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${logoSrc}" width="100" alt="Jobly" style="display:block;border:0;vertical-align:middle;">
        </td>
        <td style="vertical-align:middle;border-left:1px solid #e5e7eb;padding-left:12px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#374151;letter-spacing:0.01em;">Jobly Solutions</p>
          <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;">Workforce Portal</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Title area -->
  <tr><td style="background:#ffffff;padding:32px 40px 20px;">
    <h1 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;line-height:1.5;">${subtitle}</p>
    <div style="border-top:1px solid #f3f4f6;"></div>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:20px 40px 36px;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:16px 40px;border-top:1px solid #f3f4f6;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">&copy; 2026 Jobly Solutions &middot; Workforce Management Portal &middot; All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Azure Communication Services Email transport ──────────────────────────────
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
        <td style="padding:10px 16px;color:#8b9fc9;font-size:13px;border-bottom:1px solid #eef2ff;width:40%;font-weight:500;">${esc(label)}</td>
        <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #eef2ff;">${esc(value)}</td>
      </tr>`)
    .join('');

  const intro = bodyIntro ?? (showCreds
    ? 'Welcome aboard! HR has added you to the Jobly Workforce Portal. Below are your onboarding details and your temporary login credentials &mdash; please log in and change your password right away.'
    : 'Your Jobly Workforce Portal account is active. Use the button below to log in. If you ever forget your password, use &ldquo;Forgot password?&rdquo; on the login page.');

  const welcomeBody = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Hi <strong style="color:#111827;">${esc(firstName)} ${esc(lastName)}</strong>,</p>
<p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.7;">${intro}</p>

${rows.length ? `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border-radius:12px;border:1px solid #e4eaff;overflow:hidden;">
  <tr style="background:#f5f7ff;"><th colspan="2" style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;border-bottom:1px solid #e4eaff;">Your Details</th></tr>
  ${tableRows}
</table>` : ''}

${showCreds ? `
<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Your Login Credentials</p>
<div style="background:#f0f4ff;border:2px solid #c7d5ff;border-radius:12px;padding:18px 20px;margin-bottom:12px;">
  <p style="margin:0 0 5px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Login Email</p>
  <p style="margin:0;font-size:17px;font-weight:600;font-family:'Courier New',Courier,monospace;color:#111827;word-break:break-all;">${esc(loginEmail)}</p>
</div>
<div style="background:#fffbeb;border:2px solid #fde68a;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
  <p style="margin:0 0 5px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b45309;">Temporary Password</p>
  <p style="margin:0;font-size:24px;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:5px;color:#d97706;">${esc(tempPassword)}</p>
</div>
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;">What happens next?</p>
<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;width:100%;">
  <tr><td style="padding:5px 0;vertical-align:top;width:28px;"><div style="width:24px;height:24px;border-radius:50%;background:#4069FF;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">1</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">Click the <strong>Log In</strong> button below</td></tr>
  <tr><td style="padding:5px 0;vertical-align:top;"><div style="width:24px;height:24px;border-radius:50%;background:#4069FF;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">2</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">Enter the email and temporary password above</td></tr>
  <tr><td style="padding:5px 0;vertical-align:top;"><div style="width:24px;height:24px;border-radius:50%;background:#4069FF;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">3</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">You'll be prompted to set your own permanent password</td></tr>
</table>
<div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:28px;">
  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">&#x26A0;&#xFE0F; &nbsp;<strong>Security notice:</strong> Keep this password private. Change it immediately on your first login. Never share it with anyone.</p>
</div>
` : (loginEmail ? `
<div style="background:#f0f4ff;border:2px solid #c7d5ff;border-radius:12px;padding:18px 20px;margin-bottom:28px;">
  <p style="margin:0 0 5px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Your Login Email</p>
  <p style="margin:0;font-size:17px;font-weight:600;font-family:'Courier New',Courier,monospace;color:#111827;word-break:break-all;">${esc(loginEmail)}</p>
</div>
` : '')}

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(PORTAL_URL)}/portal/login" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Log In to Jobly Portal &rarr;
    </a>
  </td></tr>
</table>
<p style="margin:8px 0 20px;color:#9ca3af;font-size:12px;text-align:center;word-break:break-all;">
  Or copy this link: <span style="color:#4069FF;">${esc(PORTAL_URL)}/portal/login</span>
</p>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">Questions? Reach out to your HR team for assistance.</p>`;

  const html = emailShell({
    previewText: showCreds ? `Welcome ${firstName}! Your Jobly Portal credentials are ready.` : `Your Jobly Portal account — ${firstName} ${lastName}`,
    title: showCreds ? 'Welcome to Jobly Portal' : 'Your Jobly Portal Account',
    subtitle: showCreds ? 'Your employee account is ready — log in to complete your onboarding.' : 'Account update from Jobly Solutions.',
    body: welcomeBody,
  });

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
  // Optional: an admin-authored template (already placeholder-rendered) chosen
  // on the invoice. When present, the header/body/footer replace the default
  // branded shell (via buildBrandedEmail) but the line-items/total/dates block
  // below is always appended — a custom template can't omit the real billing
  // data. Absent → behavior is identical to before this field existed.
  customTemplate?: { subject?: string; headerHtml?: string; bodyHtml?: string; footerHtml?: string };
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
      <td style="padding:11px 14px;font-size:13px;color:#374151;border-bottom:1px solid #eef2ff;">${li.itemName ? `<strong style="color:#111827;">${esc(li.itemName)}</strong><br><span style="color:#9ca3af;font-size:12px;">${esc(li.description)}</span>` : esc(li.description)}</td>
      <td style="padding:11px 14px;font-size:13px;color:#6b7280;border-bottom:1px solid #eef2ff;text-align:right;">${esc(li.quantity)}</td>
      <td style="padding:11px 14px;font-size:13px;color:#6b7280;border-bottom:1px solid #eef2ff;text-align:right;">${fmt(li.unitPrice)}${li.isHours ? '/hr' : ''}</td>
      <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111827;border-bottom:1px solid #eef2ff;text-align:right;">${fmt(li.amount)}</td>
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

  const invoiceBody = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Dear <strong style="color:#111827;">${esc(contactName)}</strong>,</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.7;">
  Please find your invoice <strong style="color:#374151;">attached as a PDF</strong> for professional services rendered to <strong style="color:#374151;">${esc(clientName)}</strong>.${billingPeriodStart && billingPeriodEnd ? ` Billing period: <strong style="color:#374151;">${esc(fmtDate(billingPeriodStart))}</strong> to <strong style="color:#374151;">${esc(fmtDate(billingPeriodEnd))}</strong>.` : ''}
</p>

<!-- Amount due highlight -->
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Total Amount Due</p>
  <p style="margin:0 0 6px;font-size:30px;font-weight:800;color:#1d4ed8;letter-spacing:-0.02em;">${fmt(balanceDue ?? totalAmount)}</p>
  <p style="margin:0;font-size:13px;color:#374151;">Due by <strong style="color:#4069FF;">${esc(fmtDate(dueDate))}</strong></p>
</div>

<!-- Line items -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;border-radius:10px;border:1px solid #e4eaff;overflow:hidden;">
  <tr style="background:#f5f7ff;">
    <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #e4eaff;">Description</th>
    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #e4eaff;">${qtyHeader}</th>
    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #e4eaff;">${priceHeader}</th>
    <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #e4eaff;">Amount</th>
  </tr>
  ${lineRows}
</table>

<!-- Totals -->
<table align="right" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;min-width:220px;">
  <tr><td style="padding:5px 16px;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:5px 16px;font-size:13px;color:#111827;text-align:right;">${fmt(subtotal)}</td></tr>
  ${discountRow}${taxRow}
  <tr style="border-top:2px solid #e4eaff;">
    <td style="padding:10px 16px;font-size:15px;font-weight:800;color:#111827;">Total</td>
    <td style="padding:10px 16px;font-size:15px;font-weight:800;color:#4069FF;text-align:right;">${fmt(totalAmount)}</td>
  </tr>
  ${paidRows}
</table>

<!-- Dates -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border-radius:10px;border:1px solid #e4eaff;overflow:hidden;">
  <tr>
    <td style="padding:10px 16px;font-size:13px;color:#8b9fc9;font-weight:500;border-bottom:1px solid #eef2ff;width:42%;">Issue Date</td>
    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #eef2ff;">${esc(fmtDate(issueDate))}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px;font-size:13px;color:#8b9fc9;font-weight:500;">Payment Due</td>
    <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#dc2626;">${esc(fmtDate(dueDate))}</td>
  </tr>
</table>

${notes ? `<div style="margin-bottom:16px;background:#f5f7ff;border-left:3px solid #4069FF;border-radius:0 8px 8px 0;padding:12px 16px;font-size:13px;color:#374151;line-height:1.6;">${esc(notes)}</div>` : ''}
${terms ? `<p style="margin:0 0 24px;font-size:12px;color:#9ca3af;line-height:1.6;">${esc(terms)}</p>` : ''}

${pdfUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(pdfUrl)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Download Invoice PDF &darr;
    </a>
  </td></tr>
</table>` : ''}

<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">
  Questions about this invoice? Contact us at <a href="mailto:billing@joblysolutions.com" style="color:#4069FF;text-decoration:none;">billing@joblysolutions.com</a>
</p>`;

  const { customTemplate } = payload;
  const defaultSubject = `Invoice ${invoiceNumber} from Jobly Solutions — Due ${fmtDate(dueDate)}`;

  const html = customTemplate
    ? buildBrandedEmail({
        headerHtml: customTemplate.headerHtml,
        bodyHtml: `${customTemplate.bodyHtml ?? ''}${invoiceBody}`,
        footerHtml: customTemplate.footerHtml,
      })
    : emailShell({
        previewText: `Invoice ${invoiceNumber} from Jobly Solutions — ${fmt(balanceDue ?? totalAmount)} due ${fmtDate(dueDate)}`,
        title: `Invoice from Jobly Solutions`,
        subtitle: `${esc(invoiceNumber)} · ${esc(clientName)}`,
        body: invoiceBody,
      });

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
    subject: (customTemplate?.subject && customTemplate.subject.trim()) || defaultSubject,
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
  const contactBody = `
<p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Sender Details</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border-radius:10px;border:1px solid #e4eaff;overflow:hidden;">
  <tr><td style="padding:11px 16px;font-size:13px;color:#8b9fc9;font-weight:500;border-bottom:1px solid #eef2ff;width:38%;">Name</td><td style="padding:11px 16px;font-size:13px;font-weight:700;color:#111827;border-bottom:1px solid #eef2ff;">${esc(p.name)}</td></tr>
  <tr><td style="padding:11px 16px;font-size:13px;color:#8b9fc9;font-weight:500;border-bottom:1px solid #eef2ff;">Email</td><td style="padding:11px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #eef2ff;"><a href="mailto:${esc(p.email)}" style="color:#4069FF;text-decoration:none;">${esc(p.email)}</a></td></tr>
  ${p.phone ? `<tr><td style="padding:11px 16px;font-size:13px;color:#8b9fc9;font-weight:500;border-bottom:1px solid #eef2ff;">Phone</td><td style="padding:11px 16px;font-size:13px;color:#374151;border-bottom:1px solid #eef2ff;">${esc(p.phone)}</td></tr>` : ''}
  ${p.subject ? `<tr><td style="padding:11px 16px;font-size:13px;color:#8b9fc9;font-weight:500;">Subject</td><td style="padding:11px 16px;font-size:13px;font-weight:600;color:#374151;">${esc(p.subject)}</td></tr>` : ''}
</table>
<p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Message</p>
<div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;background:#f5f7ff;border-left:4px solid #4069FF;border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:24px;">${esc(p.message)}</div>
<div style="background:#f0f4ff;border-radius:10px;padding:12px 16px;text-align:center;">
  <p style="margin:0;font-size:13px;color:#6b7280;">Reply directly to this email to respond to <strong style="color:#374151;">${esc(p.name)}</strong></p>
</div>`;

  const html = emailShell({
    previewText: `New contact message from ${p.name}${p.subject ? ` — ${p.subject}` : ''}`,
    title: 'New Contact Message',
    subtitle: `From joblysolutions.com — Contact Us form`,
    body: contactBody,
  });

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
  const reminderGradient = payload.tone === 'overdue'
    ? 'linear-gradient(135deg,#dc2626 0%,#ef4444 100%)'
    : payload.tone === 'due'
      ? 'linear-gradient(135deg,#d97706 0%,#f59e0b 100%)'
      : 'linear-gradient(135deg,#4069FF 0%,#0ea5e9 100%)';
  const reminderEmoji = payload.tone === 'overdue' ? '🚨' : payload.tone === 'due' ? '⏰' : '🔔';
  const reminderBgColor = payload.tone === 'overdue' ? '#fef2f2' : payload.tone === 'due' ? '#fffbeb' : '#f0f4ff';
  const reminderBorderColor = payload.tone === 'overdue' ? '#fecaca' : payload.tone === 'due' ? '#fde68a' : '#c7d5ff';
  const reminderAmountColor = payload.tone === 'overdue' ? '#dc2626' : payload.tone === 'due' ? '#d97706' : '#4069FF';

  const reminderBody = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Hi <strong style="color:#111827;">${esc(payload.contactName || 'there')}</strong>,</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.7;">${intro}</p>

<div style="background:${reminderBgColor};border:2px solid ${reminderBorderColor};border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Balance Due — ${esc(payload.invoiceNumber)}</p>
  <p style="margin:0 0 8px;font-size:36px;font-weight:800;color:${reminderAmountColor};letter-spacing:-0.02em;">${fmt(payload.balanceDue)}</p>
  <p style="margin:0;font-size:13px;color:#6b7280;">${payload.tone === 'overdue' ? `Was due on` : `Due by`} <strong style="color:#374151;">${fmtDate(payload.dueDate)}</strong></p>
</div>

${payload.viewUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(payload.viewUrl)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      View Invoice &amp; Pay &rarr;
    </a>
  </td></tr>
</table>` : ''}

<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">
  Questions? Contact us at <a href="mailto:billing@joblysolutions.com" style="color:#4069FF;text-decoration:none;">billing@joblysolutions.com</a>
</p>`;

  const html = emailShell({
    previewText: `${headline} — ${fmt(payload.balanceDue)} due`,
    title: headline,
    subtitle: `Invoice ${esc(payload.invoiceNumber)} · Jobly Solutions`,
    body: reminderBody,
  });

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
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #eef2ff;white-space:nowrap;font-weight:500;">${esc(r.date)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#9ca3af;border-bottom:1px solid #eef2ff;">${esc(r.day)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #eef2ff;">${esc(r.project || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #eef2ff;">${esc(r.task || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #eef2ff;text-align:center;">${esc(r.start || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #eef2ff;text-align:center;">${esc(r.end || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#4069FF;border-bottom:1px solid #eef2ff;text-align:center;">${r.hours > 0 ? fmtH(r.hours) : '—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #eef2ff;text-align:center;">${esc(cap(r.status))}</td>
    </tr>`).join('');

  const timesheetBody = `
<p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.7;">
  <strong style="color:#374151;">${esc(employeeName)}</strong> submitted their attendance timesheet for <strong style="color:#374151;">${esc(monthLabel)}</strong>. Current status: <strong style="color:#4069FF;">${esc(cap(status))}</strong>.
</p>

<!-- Stat boxes -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;border-collapse:separate;border-spacing:8px;">
  <tr>
    <td style="background:#f0f4ff;border-radius:10px;padding:16px 12px;text-align:center;width:20%;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Total Hours</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#4069FF;">${fmtH(totalHours)}</p>
    </td>
    <td style="background:#fffbeb;border-radius:10px;padding:16px 12px;text-align:center;width:20%;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#b45309;">Expected</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#d97706;">${fmtH(expectedHours)}</p>
    </td>
    <td style="background:${balance >= 0 ? '#f0fdf4' : '#fef2f2'};border-radius:10px;padding:16px 12px;text-align:center;width:20%;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${balance >= 0 ? '#166534' : '#991b1b'};">Balance</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:${balance >= 0 ? '#16a34a' : '#dc2626'};">${balance >= 0 ? '+' : ''}${fmtH(balance)}</p>
    </td>
    <td style="background:#f5f7ff;border-radius:10px;padding:16px 12px;text-align:center;width:20%;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Work Days</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#374151;">${workingDays}</p>
    </td>
    <td style="background:#f5f7ff;border-radius:10px;padding:16px 12px;text-align:center;width:20%;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;">Leave Days</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#374151;">${leaveDays}</p>
    </td>
  </tr>
</table>

<!-- Timesheet rows -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e4eaff;border-radius:10px;overflow:hidden;margin-bottom:24px;">
  <tr style="background:#f5f7ff;">
    <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Date</th>
    <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Day</th>
    <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Project</th>
    <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Task</th>
    <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Start</th>
    <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">End</th>
    <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Hours</th>
    <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#8b9fc9;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e4eaff;">Status</th>
  </tr>
  ${lineRows}
</table>

${pdfUrl ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(pdfUrl)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Download Timesheet PDF &darr;
    </a>
  </td></tr>
</table>` : ''}

<p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">Review this timesheet in the Jobly Portal under <strong style="color:#6b7280;">Attendance Review</strong>.</p>`;

  const html = emailShell({
    previewText: `Timesheet submitted — ${employeeName} (${employeeDisplayId}) — ${monthLabel}`,
    title: `Monthly Timesheet — ${esc(monthLabel)}`,
    subtitle: `${esc(employeeName)} &middot; ${esc(employeeDisplayId)}${department ? ` &middot; ${esc(department)}` : ''}`,
    body: timesheetBody,
  });

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

  const onbTableRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 16px;color:#8b9fc9;font-size:13px;border-bottom:1px solid #eef2ff;width:38%;font-weight:500;">${esc(label)}</td>
        <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #eef2ff;">${esc(value)}</td>
      </tr>`)
    .join('');

  const onboardingSubmittedBody = `
<!-- Action needed callout -->
<div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;">
  <span style="font-size:24px;margin-right:12px;">&#x1F7E2;</span>
  <div>
    <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#166534;">Action Required</p>
    <p style="margin:0;font-size:13px;color:#16a34a;">Review and approve this employee's onboarding submission</p>
  </div>
</div>

<p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.7;">
  <strong style="color:#374151;">${esc(employeeName)}</strong> has submitted their onboarding paperwork and is <strong style="color:#374151;">awaiting HR review</strong>. Open their profile, review the details and uploaded documents, then click <strong style="color:#374151;">Approve Onboarding</strong> to activate their account.
</p>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border-radius:12px;border:1px solid #e4eaff;overflow:hidden;">
  <tr style="background:#f5f7ff;"><th colspan="2" style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b9fc9;border-bottom:1px solid #e4eaff;">Submission Details</th></tr>
  ${onbTableRows}
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(link)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Review &amp; Approve &rarr;
    </a>
  </td></tr>
</table>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">This employee's account will remain inactive until you approve their onboarding.</p>`;

  const html = emailShell({
    previewText: `Action required — ${employeeName} submitted onboarding for your review`,
    title: 'Onboarding Submitted for Review',
    subtitle: `${esc(employeeName)} (${esc(displayId)}) is awaiting your approval`,
    body: onboardingSubmittedBody,
  });

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

  const changesBody = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Hi <strong style="color:#111827;">${esc(employeeName)}</strong>,</p>
<p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.7;">
  HR has reviewed your onboarding submission for <strong style="color:#374151;">${esc(displayId)}</strong> and requested a few changes before they can approve it.
  Please review their note below, update your information in the portal, and resubmit.
</p>

<!-- HR message -->
<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">HR's Note</p>
<div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:28px;font-size:14px;color:#78350f;line-height:1.65;">
  ${messageHtml}
</div>

<!-- Steps to fix -->
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;">How to fix this:</p>
<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;width:100%;">
  <tr><td style="padding:5px 0;vertical-align:top;width:28px;"><div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">1</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">Click the button below to open your onboarding form</td></tr>
  <tr><td style="padding:5px 0;vertical-align:top;"><div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">2</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">Update the sections mentioned in HR's note above</td></tr>
  <tr><td style="padding:5px 0;vertical-align:top;"><div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">3</div></td><td style="padding:5px 0 5px 10px;font-size:14px;color:#374151;line-height:1.5;vertical-align:top;">Click <strong>Finish Onboarding</strong> to resubmit for HR review</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(link)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Update My Information &rarr;
    </a>
  </td></tr>
</table>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">Questions about what to change? Reach out to your HR team directly.</p>`;

  const html = emailShell({
    previewText: `Onboarding update needed — HR has requested changes for ${displayId}`,
    title: 'Changes Requested',
    subtitle: `HR has reviewed your onboarding for ${esc(displayId)} and needs a few updates`,
    body: changesBody,
  });

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Onboarding — changes requested for ${employeeName} (${displayId})`,
    html,
  });
}

export interface DocumentRequestEmailPayload {
  to: string | string[];
  employeeName: string;
  displayId: string;
  message: string;      // HR's freeform message describing what's needed
  portalUrl?: string;   // Deep link to the employee's profile/documents page
}

// Sent when HR/admin uses "Request Documents" on an active (post-onboarding)
// employee's profile, or "Notify" on an expiring-document row — asks the
// employee to upload/provide something outside the onboarding flow.
export async function sendDocumentRequestEmail(payload: DocumentRequestEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const { to, employeeName, displayId, message, portalUrl } = payload;
  const link = portalUrl || `${PORTAL_URL}/portal/profile`;
  const messageHtml = esc(message).replace(/\n/g, '<br>');

  const body = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Hi <strong style="color:#111827;">${esc(employeeName)}</strong>,</p>
<p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.7;">
  HR needs something from you regarding your employee record <strong style="color:#374151;">${esc(displayId)}</strong>. Please see their note below.
</p>

<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">HR's Request</p>
<div style="background:#eff6ff;border-left:4px solid #4069FF;border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:28px;font-size:14px;color:#1e3a8a;line-height:1.65;">
  ${messageHtml}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
  <tr><td align="center">
    <a href="${esc(link)}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      Go to My Profile &rarr;
    </a>
  </td></tr>
</table>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">Questions about what's needed? Reach out to your HR team directly.</p>`;

  const html = emailShell({
    previewText: `HR needs something from you — ${displayId}`,
    title: 'Document Request',
    subtitle: `HR has a request regarding your record ${esc(displayId)}`,
    body,
  });

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Action needed — HR request for ${employeeName} (${displayId})`,
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

export interface AnnouncementEmailPayload {
  to: string | string[];
  announcementTitle: string;
  announcementBody: string;
  announcementType: string;
  authorName: string;
}

export async function sendAnnouncementEmail(p: AnnouncementEmailPayload): Promise<void> {
  if (!mailerConfigured) return;

  const TYPE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    urgent: { label: 'Urgent',  bg: '#fef2f2', color: '#dc2626' },
    event:  { label: 'Event',   bg: '#ecfdf5', color: '#059669' },
    policy: { label: 'Policy',  bg: '#f5f3ff', color: '#7c3aed' },
    info:   { label: 'Info',    bg: '#eff6ff', color: '#2563eb' },
  };
  const style = TYPE_STYLES[p.announcementType] ?? TYPE_STYLES.info;

  const announcementBody = `
<p style="margin:0 0 20px;">
  <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;background:${esc(style.bg)};color:${esc(style.color)};">
    ${esc(style.label)}
  </span>
</p>
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;line-height:1.3;">${esc(p.announcementTitle)}</h2>
<div style="background:#f9fafb;border-left:4px solid ${esc(style.color)};border-radius:0 8px 8px 0;padding:16px 18px;margin-bottom:28px;">
  <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${esc(p.announcementBody)}</p>
</div>
<p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Posted by <strong style="color:#6b7280;">${esc(p.authorName)}</strong></p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
  <tr><td align="center">
    <a href="${esc(PORTAL_URL)}/portal/announcements" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;">
      View in Portal &rarr;
    </a>
  </td></tr>
</table>`;

  const html = emailShell({
    previewText: `New announcement: ${p.announcementTitle}`,
    title: 'New Announcement',
    subtitle: `From Jobly Solutions &mdash; ${esc(style.label)}`,
    body: announcementBody,
  });

  await sendWithRetry({
    from: FROM,
    to: p.to,
    subject: `[Announcement] ${p.announcementTitle}`,
    html,
  });
}

// ── Performance appraisal report ─────────────────────────────────────────────

export interface PerformanceReviewEmailPayload {
  to: string;
  employeeName: string;
  displayId: string;
  periodStart: string;
  periodEnd: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

export async function sendPerformanceReviewEmail(payload: PerformanceReviewEmailPayload): Promise<void> {
  if (!mailerConfigured) {
    throw new Error('Email is not configured. Set AZURE_COMM_CONNECTION_STRING in Azure App Settings.');
  }
  const { to, employeeName, displayId, periodStart, periodEnd, pdfBuffer, pdfFileName } = payload;
  const period = `${formatDateUS(periodStart)} to ${formatDateUS(periodEnd)}`;

  const body = `
<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">Dear <strong style="color:#111827;">${esc(employeeName)}</strong>,</p>
<p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.7;">
  Your performance evaluation for the period <strong style="color:#374151;">${esc(period)}</strong> is attached as a PDF. Please review it at your convenience.
</p>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
  <p style="margin:0;font-size:13px;color:#374151;">Report ID: <strong style="color:#1d4ed8;">${esc(displayId)}</strong></p>
</div>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
  Questions about this evaluation? Reach out to your supervisor or HR.
</p>`;

  const html = emailShell({
    previewText: `Your performance evaluation for ${period} is ready`,
    title: 'Performance Evaluation',
    subtitle: `${esc(displayId)} &middot; ${esc(period)}`,
    body,
  });

  await sendWithRetry({
    from: FROM,
    to,
    subject: `Performance Evaluation — ${period}`,
    html,
    attachments: [{ filename: pdfFileName, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}
