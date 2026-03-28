import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend requires a verified sender domain. During development/testing
// we fall back to the sandbox address they provide.
const FROM = 'Jobly HR <onboarding@resend.dev>';
const PORTAL_URL = process.env.FRONTEND_URL ?? 'http://localhost:8080';

export interface WelcomeEmailPayload {
  to: string;
  firstName: string;
  lastName: string;
  displayId: string;
  jobTitle?: string;
  department?: string;
  startDate?: string;
  workLocation?: string;
  employmentType?: string;
  paymentType?: string;
  loginEmail?: string;
  tempPassword?: string;
}

export async function sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
  const {
    to, firstName, lastName, displayId,
    jobTitle, department, startDate, workLocation, employmentType, paymentType,
    loginEmail, tempPassword,
  } = payload;

  const rows = [
    ['Employee ID', displayId],
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
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${label}</td>
        <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:500;border-bottom:1px solid #f3f4f6;">${value}</td>
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

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4069FF,#32CDDC);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome to Jobly Portal</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your employee account is ready</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">Hi <strong>${firstName} ${lastName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              Welcome aboard! HR has added you to the Jobly Workforce Portal. Below are your onboarding details.
              You will receive a separate email with a link to set your password and log in.
            </p>

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

            ${loginEmail && tempPassword ? `
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
                  <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;font-family:monospace;border-bottom:1px solid #e5e7eb;">${loginEmail}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Temporary Password</td>
                  <td style="padding:12px 16px;font-size:15px;font-weight:700;font-family:monospace;letter-spacing:2px;color:#4069FF;">${tempPassword}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin:0 0 24px;color:#dc2626;font-size:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
              ⚠️ Please log in and change your password immediately. Do not share these credentials with anyone.
            </p>
            ` : ''}

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${PORTAL_URL}/portal/login"
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

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to Jobly Portal — ${displayId}`,
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
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  pdfUrl?: string;
  notes?: string;
  lineItems: { description: string; hours: number; billRate: number; amount: number }[];
}

export async function sendInvoiceEmail(payload: InvoiceEmailPayload): Promise<void> {
  const {
    to, clientName, contactName, invoiceNumber,
    issueDate, dueDate, subtotal, taxRate, taxAmount, totalAmount,
    billingPeriodStart, billingPeriodEnd, pdfUrl, notes, lineItems,
  } = payload;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const lineRows = lineItems.map(li => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${li.description}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">${li.hours}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right;">$${li.billRate}/hr</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(li.amount)}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#4069FF,#32CDDC);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Invoice from Jobly Solutions</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${invoiceNumber}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${contactName}</strong>,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.6;">
              Please find attached the invoice for staffing services rendered to <strong>${clientName}</strong>.
              ${billingPeriodStart && billingPeriodEnd ? `Billing period: <strong>${fmtDate(billingPeriodStart)}</strong> to <strong>${fmtDate(billingPeriodEnd)}</strong>.` : ''}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Description</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Hours</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Rate</th>
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
              ${taxRate > 0 ? `<tr>
                <td style="padding:6px 16px;font-size:13px;color:#6b7280;">Tax (${taxRate}%)</td>
                <td style="padding:6px 16px;font-size:13px;color:#111827;text-align:right;">${fmt(taxAmount)}</td>
              </tr>` : ''}
              <tr style="background:#f9fafb;">
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#111827;border-top:2px solid #e5e7eb;">Total Due</td>
                <td style="padding:10px 16px;font-size:15px;font-weight:700;color:#4069FF;border-top:2px solid #e5e7eb;text-align:right;">${fmt(totalAmount)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:40%;">Issue Date</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #f3f4f6;">${fmtDate(issueDate)}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6b7280;">Payment Due</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#dc2626;">${fmtDate(dueDate)}</td>
              </tr>
            </table>

            ${notes ? `<p style="margin:0 0 24px;font-size:13px;color:#6b7280;background:#f9fafb;border-left:3px solid #4069FF;padding:12px 16px;border-radius:4px;">${notes}</p>` : ''}

            ${pdfUrl ? `<table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${pdfUrl}" style="display:inline-block;background:#4069FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
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

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Invoice ${invoiceNumber} from Jobly Solutions — Due ${fmtDate(dueDate)}`,
    html,
  });
}
