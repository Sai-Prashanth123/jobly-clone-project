import { describe, it, expect, vi } from 'vitest';

// The module reads SES config at import time; nothing here sends.
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { async send() { return {}; } },
  SendEmailCommand: class {},
}));

import { buildRawMessage } from './mailer';
import { getJoblyLogoBuffer } from './joblyLogo';

/**
 * The invoice logo must travel inside the message.
 *
 * It used to be hotlinked from the portal host. That URL is live and returns a
 * valid PNG — but Outlook does not load remote images by default, so a client
 * opening an invoice saw the red-X "linked image cannot be displayed" box
 * where the company logo should be. A cid: part is part of the email, so there
 * is nothing to block and nothing to fetch.
 *
 * buildRawMessage also used to drop every attachment carrying a `cid`, which
 * is why the templates hotlinked in the first place. Both halves are asserted
 * here, against the composed bytes rather than against the template source.
 */
describe('the logo is embedded, not linked', () => {
  it('emits an inline image part when the html references it', async () => {
    const raw = (await buildRawMessage({
      to: 'client@example.com',
      subject: 'Invoice',
      html: '<img src="cid:jobly-logo"> hello',
    })).toString('utf8');

    expect(raw, 'no inline Content-ID part was produced').toMatch(/Content-ID:\s*<jobly-logo>/i);
    expect(raw).toMatch(/Content-Type:\s*image\/png/i);
    expect(raw).toMatch(/Content-Disposition:\s*inline/i);
  });

  it('carries the real logo bytes', async () => {
    const raw = (await buildRawMessage({
      to: 'client@example.com', subject: 'Invoice', html: '<img src="cid:jobly-logo">',
    })).toString('utf8');

    // The PNG arrives base64-encoded and line-wrapped; compare on a prefix
    // long enough to be unique but short enough to survive the wrapping.
    const b64 = getJoblyLogoBuffer().toString('base64');
    expect(raw.replace(/\r?\n/g, '')).toContain(b64.slice(0, 60));
  });

  it('does not attach the logo to mail that never asks for it', async () => {
    const raw = (await buildRawMessage({
      to: 'someone@example.com', subject: 'Plain', html: '<p>no logo here</p>',
    })).toString('utf8');

    expect(raw).not.toMatch(/Content-ID:\s*<jobly-logo>/i);
  });

  // The regression that caused this: every cid attachment was filtered out.
  it('keeps a caller-supplied inline attachment', async () => {
    const raw = (await buildRawMessage({
      to: 'a@example.com', subject: 'S', html: '<img src="cid:custom">',
      attachments: [{
        filename: 'c.png', content: Buffer.from('fake'), contentType: 'image/png', cid: 'custom',
      }],
    })).toString('utf8');

    expect(raw).toMatch(/Content-ID:\s*<custom>/i);
  });

  it('still carries ordinary file attachments', async () => {
    const raw = (await buildRawMessage({
      to: 'a@example.com', subject: 'S', html: '<p>x</p>',
      attachments: [{
        filename: 'invoice.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf',
      }],
    })).toString('utf8');

    expect(raw).toContain('invoice.pdf');
  });
});
