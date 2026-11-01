import { SESv2Client, GetSuppressedDestinationCommand } from '@aws-sdk/client-sesv2';
import { AppError } from './errors';

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

/**
 * An AppError, not a plain Error, so the message above actually reaches the
 * person who pressed Send.
 *
 * errorHandler relays `message` and `statusCode` for an AppError and answers
 * everything else with `{ error: 'Internal server error' }`. As a plain Error
 * this text was written, thrown, and then swallowed: finance clicking "Send
 * reminder" on a client whose address had hard-bounced got an opaque 500 with
 * no hint that the address was the problem.
 *
 * 422 rather than 400: the request is well formed, the address on file is not
 * usable.
 */
export class AllRecipientsSuppressedError extends AppError {
  readonly suppressed: string[];
  constructor(suppressed: string[]) {
    super(
      `Email not sent: ${suppressed.join(', ')} ${suppressed.length === 1 ? 'is' : 'are'} ` +
      'on the SES suppression list after a permanent bounce, so SES would accept the ' +
      'message and discard it. Correct the address before sending.',
      422,
      true,
      { suppressed },
    );
    // AppError's own constructor pins the prototype to AppError, which would
    // otherwise make `instanceof AllRecipientsSuppressedError` false here.
    Object.setPrototypeOf(this, AllRecipientsSuppressedError.prototype);
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

/** How many SESv2 lookups may be in flight at once — see splitSuppressed. */
const MAX_CONCURRENT_LOOKUPS = 4;

/** How long the whole check may take before the rest are assumed deliverable. */
const LOOKUP_BUDGET_MS = 3000;

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

  // Bounded, and time-boxed.
  //
  // This used to be Promise.all over every address. SESv2's account-level
  // operations are low-TPS, so an all-staff announcement to a few dozen
  // employees opened that many concurrent lookups, most of which throttled and
  // were retried by the SDK before failing open — seconds spent in suppression
  // checks before SendEmail was even reached, inside a Lambda with a timeout.
  //
  // Whatever is still unchecked when the budget runs out counts as
  // deliverable: the same fail-open answer a lookup error gives, for the same
  // reason. A slow check must not be why an invoice does not go out.
  const deadline = Date.now() + LOOKUP_BUDGET_MS;
  const flags = new Map<string, boolean>();
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < unique.length) {
      const address = unique[cursor++];
      if (Date.now() >= deadline) {
        console.warn(`[mailSuppression] budget spent, assuming ${address} is deliverable`);
        flags.set(address, false);
        continue;
      }
      flags.set(address, await isSuppressed(address));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_LOOKUPS, unique.length) }, worker),
  );

  const bad = new Set([...flags].filter(([, s]) => s).map(([x]) => x));
  if (bad.size === 0) return { to: a.to, cc: a.cc ?? [], bcc: a.bcc ?? [], suppressed: [] };

  const keep = (list: string[]) => list.filter(x => !bad.has(x.trim().toLowerCase()));
  return {
    to: keep(a.to),
    cc: keep(a.cc ?? []),
    bcc: keep(a.bcc ?? []),
    suppressed: [...bad],
  };
}
