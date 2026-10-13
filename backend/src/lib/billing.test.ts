import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BILLING_EMAIL, BILLING_FROM, BILLING_FOOTER } from './billing';

/**
 * Finance asked for invoice mail to come from `ap@`. The old address was
 * hardcoded in five places and seeded into the database, so "we changed it"
 * was never a safe claim. These assert the rendered output, not the constant —
 * a constant that nothing uses would pass a weaker test.
 */

const sendMock = vi.fn().mockResolvedValue({});

/** Only the parts of the SES input these tests read. */
interface SesInput {
  FromEmailAddress: string;
  Destination: { ToAddresses?: string[]; BccAddresses?: string[] };
  Content: { Raw: { Data: Uint8Array } };
}

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { send = sendMock; },
  SendEmailCommand: class {
    constructor(public input: SesInput) {}
  },
}));

async function loadMailer() {
  process.env.MAIL_DRIVER = 'ses';
  process.env.MAIL_FROM = 'Jobly Portal <no-reply@joblysolutions.com>';
  vi.resetModules();
  return import('./mailer');
}

const lastInput = () => (sendMock.mock.calls.at(-1)![0] as { input: SesInput }).input;
const lastRaw = () => Buffer.from(lastInput().Content.Raw.Data).toString('utf-8');
const lastFrom = () => lastInput().FromEmailAddress;

const INVOICE = {
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
  lineItems: [
    { description: 'Week of 2026-10-05 (40 hrs)', quantity: 40, unitPrice: 105, amount: 4200, isHours: true },
  ],
};

describe('billing constants', () => {
  it('default to the finance mailbox', () => {
    expect(BILLING_EMAIL).toBe('ap@joblysolutions.com');
    expect(BILLING_FROM).toBe('Jobly Solutions <ap@joblysolutions.com>');
    expect(BILLING_FOOTER).toContain('ap@joblysolutions.com');
  });

  it('carry no trace of the old address', () => {
    for (const v of [BILLING_EMAIL, BILLING_FROM, BILLING_FOOTER]) {
      expect(v).not.toContain('billing@');
      expect(v).not.toContain('no-reply@');
    }
  });
});

describe('invoice email', () => {
  beforeEach(() => sendMock.mockClear());

  // The screenshot that prompted this: "Jobly Portal <no-reply@...>" in the
  // inbox, and a footer offering billing@ as the contact.
  it('is sent from the finance mailbox, not the generic sender', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail(INVOICE);

    expect(lastFrom()).toBe(BILLING_FROM);
    expect(lastFrom()).not.toContain('no-reply@');
  });

  it('sets Reply-To so a customer replying reaches accounts payable', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail(INVOICE);
    expect(lastRaw()).toMatch(new RegExp(`^Reply-To:.*${BILLING_EMAIL}`, 'im'));
  });

  it('shows the finance address in the body, not billing@', async () => {
    const { sendInvoiceEmail } = await loadMailer();
    await sendInvoiceEmail(INVOICE);

    const raw = lastRaw();
    // Quoted-printable can wrap long lines, so compare on a de-wrapped copy.
    const body = raw.replace(/=\r?\n/g, '');
    expect(body).toContain(BILLING_EMAIL);
    expect(body).not.toContain('billing@joblysolutions.com');
  });

  it('applies the same treatment to payment reminders', async () => {
    const { sendInvoiceReminderEmail } = await loadMailer();
    await sendInvoiceReminderEmail({
      to: 'client@example.com',
      clientName: 'Acme Corp',
      contactName: 'Jane',
      invoiceNumber: 'INV-2026-0013',
      dueDate: '2026-11-26',
      balanceDue: 4200,
      tone: 'overdue' as const,
    });

    expect(lastFrom()).toBe(BILLING_FROM);
    expect(lastRaw().replace(/=\r?\n/g, '')).not.toContain('billing@joblysolutions.com');
  });
});

describe('non-invoice email keeps the portal sender', () => {
  beforeEach(() => sendMock.mockClear());

  // Only money mail moves to ap@ — that was the explicit decision. A welcome
  // email arriving from accounts payable would be odd.
  it('sends a welcome email from MAIL_FROM', async () => {
    const { sendWelcomeEmail } = await loadMailer();
    await sendWelcomeEmail({
      to: 'new.hire@example.com',
      firstName: 'Sam',
      lastName: 'Lee',
      loginEmail: 'new.hire@example.com',
      tempPassword: 'TempPass123',
      displayId: 'EMP-0150',
    });

    expect(lastFrom()).toBe('Jobly Portal <no-reply@joblysolutions.com>');
  });
});
