import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The guard that stops the app reporting a send it did not make.
 *
 * SES accepts mail addressed to a suppressed recipient and discards it. The
 * reminder for INV-2026-0002 was binned that way every run while
 * `reminder_count` climbed and the offset was recorded, so the milestone never
 * fired again and nobody chased the client. These cases pin the two behaviours
 * that matter: undeliverable addresses are removed, and a send with nothing
 * left must fail loudly rather than return.
 */

const send = vi.fn();
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class { send = send; },
  GetSuppressedDestinationCommand: class {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  },
}));

import {
  splitSuppressed,
  clearSuppressionCache,
  AllRecipientsSuppressedError,
} from './mailSuppression';

/** SES answers NotFoundException for an address that is NOT suppressed. */
const notFound = () => {
  const e = new Error('not found');
  e.name = 'NotFoundException';
  return e;
};

/** Suppressed addresses resolve; everything else throws NotFoundException. */
const suppress = (...bad: string[]) => {
  send.mockImplementation((cmd: { input: { EmailAddress: string } }) => {
    if (bad.includes(cmd.input.EmailAddress)) return Promise.resolve({});
    return Promise.reject(notFound());
  });
};

beforeEach(() => {
  send.mockReset();
  clearSuppressionCache();
});

describe('splitSuppressed', () => {
  it('passes everything through when nothing is suppressed', async () => {
    suppress();
    const out = await splitSuppressed({ to: ['a@x.test'], cc: ['b@x.test'] });
    expect(out.suppressed).toEqual([]);
    expect(out.to).toEqual(['a@x.test']);
    expect(out.cc).toEqual(['b@x.test']);
  });

  it('removes only the undeliverable address', async () => {
    suppress('bad@x.test');
    const out = await splitSuppressed({ to: ['good@x.test', 'bad@x.test'] });
    expect(out.to).toEqual(['good@x.test']);
    expect(out.suppressed).toEqual(['bad@x.test']);
  });

  it('keeps an announcement alive when one bcc has gone bad', async () => {
    // Nineteen people should still get it; one dead address is not a reason
    // to cancel the send.
    suppress('gone@x.test');
    const out = await splitSuppressed({
      to: ['hr@x.test'],
      bcc: ['one@x.test', 'gone@x.test', 'two@x.test'],
    });
    expect(out.bcc).toEqual(['one@x.test', 'two@x.test']);
    expect(out.to).toEqual(['hr@x.test']);
  });

  it('matches case-insensitively, as SES does', async () => {
    suppress('bad@x.test');
    const out = await splitSuppressed({ to: ['BAD@X.test'] });
    expect(out.to).toEqual([]);
    expect(out.suppressed).toEqual(['bad@x.test']);
  });

  it('fails open when the lookup itself breaks', async () => {
    // A missing permission or a throttle must never be why an invoice does
    // not go out. Worst case is the behaviour we already had.
    send.mockRejectedValue(Object.assign(new Error('AccessDenied'), { name: 'AccessDeniedException' }));
    const out = await splitSuppressed({ to: ['a@x.test'] });
    expect(out.suppressed).toEqual([]);
    expect(out.to).toEqual(['a@x.test']);
  });

  it('asks SES once per address, not once per message', async () => {
    suppress('bad@x.test');
    await splitSuppressed({ to: ['bad@x.test'] });
    await splitSuppressed({ to: ['bad@x.test'] });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not cache a non-answer', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('throttled'), { name: 'TooManyRequestsException' }));
    await splitSuppressed({ to: ['a@x.test'] });
    suppress('a@x.test');
    const out = await splitSuppressed({ to: ['a@x.test'] });
    expect(out.suppressed).toEqual(['a@x.test']);
  });
});

describe('AllRecipientsSuppressedError', () => {
  it('names the address and says why, so finance can act on it', () => {
    const err = new AllRecipientsSuppressedError(['anitha@example.test']);
    expect(err.message).toContain('anitha@example.test');
    expect(err.message).toMatch(/suppression list/i);
    expect(err.message).toMatch(/correct the address/i);
    expect(err.suppressed).toEqual(['anitha@example.test']);
  });
});
