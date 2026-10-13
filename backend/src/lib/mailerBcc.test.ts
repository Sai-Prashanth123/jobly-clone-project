import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Announcement email disclosed every employee's address.
 *
 * `sendAnnouncementEmail` passed the whole recipient list as `to:`, so one
 * message went out with ~20 staff addresses in the `To:` header, visible to
 * each of them. This pins the fix at the only two places it can regress: the
 * SES envelope (`BccAddresses`) and the composed MIME headers, which are built
 * independently of each other — putting an address in one does not put it in
 * the other, and the original bug is what happens when they disagree.
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

const EMPLOYEES = [
  'sydulu.v@joblysolutions.com',
  'rajyalakshmi.b@joblysolutions.com',
  'chaitanya.a@joblysolutions.com',
];

async function loadMailer() {
  process.env.MAIL_DRIVER = 'ses';
  process.env.MAIL_FROM = 'Jobly Portal <no-reply@joblysolutions.com>';
  vi.resetModules();
  return import('./mailer');
}

/** The raw MIME bytes handed to SES for the last send. */
function lastRawMime(): string {
  const cmd = sendMock.mock.calls.at(-1)![0] as { input: SesInput };
  return Buffer.from(cmd.input.Content.Raw.Data).toString('utf-8');
}

function lastDestination(): SesInput['Destination'] {
  return (sendMock.mock.calls.at(-1)![0] as { input: SesInput }).input.Destination;
}

describe('announcement email hides its recipients', () => {
  beforeEach(() => sendMock.mockClear());

  it('puts every employee in Bcc, never in the envelope To', async () => {
    const { sendAnnouncementEmail } = await loadMailer();
    await sendAnnouncementEmail({
      recipients: EMPLOYEES,
      announcementTitle: 'Hi',
      announcementBody: 'Good morning',
      announcementType: 'info',
      authorName: 'HR User',
    });

    const dest = lastDestination();
    expect(dest.BccAddresses).toEqual(EMPLOYEES);
    for (const addr of EMPLOYEES) {
      expect(dest.ToAddresses ?? [], `${addr} must not be an envelope To`).not.toContain(addr);
    }
  });

  // The headers are the half a recipient actually reads. Nodemailer will
  // happily write a Bcc header if handed one, and SES forwards the raw bytes
  // verbatim — so the addresses would be disclosed even with a correct
  // envelope.
  it('writes no recipient address into the MIME headers', async () => {
    const { sendAnnouncementEmail } = await loadMailer();
    await sendAnnouncementEmail({
      recipients: EMPLOYEES,
      announcementTitle: 'Hi',
      announcementBody: 'Good morning',
      announcementType: 'info',
      authorName: 'HR User',
    });

    const mime = lastRawMime();
    const headers = mime.split(/\r?\n\r?\n/)[0];
    for (const addr of EMPLOYEES) {
      expect(headers, `${addr} leaked into the MIME headers`).not.toContain(addr);
    }
    expect(headers).not.toMatch(/^Bcc:/im);
    // ...and the message is still addressed to something, so clients do not
    // treat a header-less message as suspicious.
    expect(headers).toMatch(/^To:/im);
  });

  it('still sends when there is a single recipient', async () => {
    const { sendAnnouncementEmail } = await loadMailer();
    await sendAnnouncementEmail({
      recipients: EMPLOYEES[0],
      announcementTitle: 'Hi',
      announcementBody: 'Body',
      announcementType: 'urgent',
      authorName: 'HR User',
    });
    expect(lastDestination().BccAddresses).toEqual([EMPLOYEES[0]]);
  });

  it('does not send at all when the recipient list is empty', async () => {
    const { sendAnnouncementEmail } = await loadMailer();
    await sendAnnouncementEmail({
      recipients: [],
      announcementTitle: 'Hi',
      announcementBody: 'Body',
      announcementType: 'info',
      authorName: 'HR User',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('ordinary email is unaffected', () => {
  beforeEach(() => sendMock.mockClear());

  // Everything else must keep a visible To:, or replies and threading break.
  it('keeps a normal recipient in both the envelope and the header', async () => {
    const { testEmailDelivery } = await loadMailer();
    await testEmailDelivery('one.person@example.com');

    expect(lastDestination().ToAddresses).toEqual(['one.person@example.com']);
    expect(lastDestination().BccAddresses).toBeUndefined();
    expect(lastRawMime()).toContain('one.person@example.com');
  });
});
