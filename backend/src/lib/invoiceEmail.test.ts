import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Three things finance asked for on invoice email:
 *   - the client's address should already be filled in
 *   - it should be possible to copy someone else in
 *   - the subject should say whose hours it covers
 *
 * The first was a frontend bug (the dialog captured its initial values before
 * the client had loaded) and is fixed there. These cover the two that reach
 * the wire: Cc must be a VISIBLE header — unlike the announcement bcc — and
 * the subject must lead with the names.
 */

const sendMock = vi.fn().mockResolvedValue({});

interface SesInput {
  FromEmailAddress: string;
  Destination: { ToAddresses?: string[]; CcAddresses?: string[]; BccAddresses?: string[] };
  Content: { Raw: { Data: Uint8Array } };
}

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { send = sendMock; },
  SendEmailCommand: class { constructor(public input: SesInput) {} },
}));

async function loadMailer() {
  process.env.MAIL_DRIVER = 'ses';
  process.env.MAIL_FROM = 'Jobly Portal <no-reply@joblysolutions.com>';
  vi.resetModules();
  return import('./mailer');
}

const lastInput = () => (sendMock.mock.calls.at(-1)![0] as { input: SesInput }).input;
const lastRaw = () => Buffer.from(lastInput().Content.Raw.Data).toString('utf-8');
/**
 * Subject header, decoded.
 *
 * Nodemailer RFC 2047-encodes any header carrying non-ASCII, and this subject
 * contains an em dash — so the raw bytes read
 * `=?UTF-8?Q?Sydulu_Vemula_=26_Aarthi...?=` rather than anything a person
 * wrote. Decoding keeps the assertions about what the recipient actually sees.
 */
function decodeWords(value: string): string {
  return value.replace(/=\?UTF-8\?Q\?([^?]*)\?=/gi, (_m, body: string) => {
    const bytes = body
      .replace(/_/g, ' ')
      .replace(/=([0-9A-F]{2})/gi, (_x, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(bytes, 'binary').toString('utf-8');
  });
}

function lastSubject(): string {
  // NOT de-wrapped with the quoted-printable rule used on the body: an encoded
  // header ends in "?=", so stripping "=\r\n" eats the terminator and the
  // decode silently does nothing. Headers fold with CRLF + whitespace instead,
  // which is what the loop below rejoins.
  const lines = lastRaw().split(/\r?\n/);
  const idx = lines.findIndex(l => l.startsWith('Subject:'));
  if (idx === -1) return '';
  // A long subject folds onto continuation lines, which begin with whitespace.
  let value = lines[idx].replace(/^Subject:\s*/, '');
  for (let i = idx + 1; i < lines.length && /^[ \t]/.test(lines[i]); i++) {
    value += lines[i].trim();
  }
  return decodeWords(value).replace(/\s+/g, ' ').trim();
}

const BASE = {
  to: 'client@example.com',
  clientName: 'Acme Corp',
  contactName: 'Jane',
  invoiceNumber: 'INV-2026-0013',
  issueDate: '2026-10-12',
  dueDate: '2026-11-26',
  subtotal: 4200,
  taxRate: 0,
  taxAmount: 0,
  totalAmount: 4200,
  lineItems: [{ description: 'Week of 2026-10-05', quantity: 40, unitPrice: 105, amount: 4200, isHours: true }],
};

describe('copying someone in', () => {
  beforeEach(() => sendMock.mockClear());

  it('puts cc on the envelope', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, cc: ['accounts@acme.com', 'manager@acme.com'] });
    expect(lastInput().Destination.CcAddresses).toEqual(['accounts@acme.com', 'manager@acme.com']);
  });

  // The opposite of the announcement rule: a cc is meant to be seen, so
  // reply-all reaches them and the recipient knows who else has it.
  it('puts cc in the visible headers too', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, cc: ['accounts@acme.com'] });
    expect(lastRaw()).toMatch(/^Cc:.*accounts@acme\.com/im);
  });

  it('sends normally when nobody is copied', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail(BASE);
    expect(lastInput().Destination.CcAddresses).toBeUndefined();
    expect(lastRaw()).not.toMatch(/^Cc:/im);
  });
});

describe('the subject says whose hours it is', () => {
  beforeEach(() => sendMock.mockClear());

  it('leads with a single name', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, employeeNames: ['Sydulu Vemula'] });
    expect(lastSubject().startsWith('Sydulu Vemula — Invoice INV-2026-0013')).toBe(true);
  });

  it('joins two names', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, employeeNames: ['Sydulu Vemula', 'Aarthi Tumu'] });
    expect(lastSubject()).toContain('Sydulu Vemula & Aarthi Tumu — Invoice');
  });

  // A subject listing eight people is no more useful than one listing none.
  it('summarises beyond two', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, employeeNames: ['A One', 'B Two', 'C Three', 'D Four'] });
    expect(lastSubject()).toContain('A One +3 more — Invoice');
  });

  it('falls back to the plain subject when no names are known', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail(BASE);
    expect(lastSubject().startsWith('Invoice INV-2026-0013')).toBe(true);
  });

  it('ignores blank names rather than printing a stray dash', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail({ ...BASE, employeeNames: ['', '  '] as string[] });
    expect(lastSubject().startsWith('Invoice INV-2026-0013')).toBe(true);
  });
});
