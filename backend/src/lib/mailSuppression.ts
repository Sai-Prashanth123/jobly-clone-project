import { SESv2Client, GetSuppressedDestinationCommand } from '@aws-sdk/client-sesv2';

/**
 * Refuse to pretend we emailed somebody SES will not deliver to.
 *
 * SES keeps an account-level suppression list. Send to an address on it and
 * SES **accepts the message and silently drops it** — the API returns a
 * MessageId, the caller sees success, and the recipient gets nothing.
 *
 * That is not theoretical. INV-2026-0002's "Payment overdue" reminder went to
 * a client whose billing address had hard-bounced (Gmail 5.1.1, "the email
 * account that you tried to reach does not exist"). SES suppressed it, every
 * later reminder was dropped on the floor, and the invoice was marked chased
 * each time — `reminder_count` incremented, the offset recorded in
 * `reminded_offsets` so that milestone never fires again. The client was never
 * actually contacted and nothing in the portal said so. That is the same shape
 * as the dunning bug that left $65k unchased for six weeks.
 *
 * So: look before sending, drop the undeliverable recipients, and make the
 * caller fail if nothing is left. A reminder that throws does not record its
 * offset, which means it stays due and visible instead of being quietly ticked
 * off.
 *
 * FAIL-OPEN, deliberately. If the lookup errors — permission missing, SES
 * unreachable, throttled — we send anyway and log it. A broken suppression
 * check must never be the reason an invoice does not go out; the worst case is
 * the behaviour we already had.
 */

export class AllRecipientsSuppressedError extends Error {
  readonly suppressed: string[];
  constructor(suppressed: string[]) {
    super(
      `Email not sent: ${suppressed.join(', ')} ${suppressed.length === 1 ? 'is' : 'are'} ` +
      'on the SES suppression list after a permanent bounce, so SES would accept the ' +
      'message and discard it. Correct the address before sending.',
    );
    this.name = 'AllRecipientsSuppressedError';
    this.suppressed = suppressed;
  }
}

let _ses: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!_ses) _ses = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
  return _ses;
}

/**
 * Short-lived cache. The daily tick can chase dozens of invoices belonging to
 * a handful of clients, and the suppression list does not change mid-run.
 * Deliberately not long-lived: an address fixed and un-suppressed should start
 * working within the hour, not after the next deploy.
 */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { suppressed: boolean; at: number }>();

/** Exported for tests, which must not inherit another case's cached answer. */
export function clearSuppressionCache(): void {
  cache.clear();
}

async function isSuppressed(address: string): Promise<boolean> {
  const key = address.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.suppressed;

  let suppressed = false;
  try {
    await ses().send(new GetSuppressedDestinationCommand({ EmailAddress: key }));
    suppressed = true;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? '';
    // NotFoundException is the ordinary answer for a deliverable address.
    if (name !== 'NotFoundException') {
      console.warn(
        `[mailSuppression] could not check ${key}, assuming deliverable: ${(err as Error)?.message ?? err}`,
      );
      return false; // fail open, and do not cache a non-answer
    }
  }

  cache.set(key, { suppressed, at: Date.now() });
  return suppressed;
}

export interface SuppressionSplit {
  to: string[];
  cc: string[];
  bcc: string[];
  /** Everything removed, across all three fields, for logging. */
  suppressed: string[];
}

/**
 * Split recipients into those SES will deliver to and those it will not.
 *
 * Partial removal rather than all-or-nothing: an announcement to twenty
 * employees must not fail because one address has gone bad, but the nineteen
 * who can receive it should still get it. Only when NOTHING is deliverable is
 * it a hard failure, because then "sent" would be a lie.
 */
export async function splitSuppressed(a: {
  to: string[];
  cc?: string[];
  bcc?: string[];
}): Promise<SuppressionSplit> {
  const all = [...a.to, ...(a.cc ?? []), ...(a.bcc ?? [])];
  const unique = [...new Set(all.map(x => x.trim().toLowerCase()))].filter(Boolean);
  if (unique.length === 0) return { to: [], cc: [], bcc: [], suppressed: [] };

  const flags = await Promise.all(unique.map(async x => [x, await isSuppressed(x)] as const));
  const bad = new Set(flags.filter(([, s]) => s).map(([x]) => x));
  if (bad.size === 0) return { to: a.to, cc: a.cc ?? [], bcc: a.bcc ?? [], suppressed: [] };

  const keep = (list: string[]) => list.filter(x => !bad.has(x.trim().toLowerCase()));
  return {
    to: keep(a.to),
    cc: keep(a.cc ?? []),
    bcc: keep(a.bcc ?? []),
    suppressed: [...bad],
  };
}
