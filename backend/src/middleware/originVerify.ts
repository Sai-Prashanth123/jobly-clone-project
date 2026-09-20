import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';

// Reject anything that did not come through CloudFront.
//
// The API Gateway default endpoint (…execute-api.amazonaws.com) is public and
// HTTP APIs cannot take a resource policy, so without this check every WAF
// rule on the distribution - rate limiting, the managed rule sets, IP
// reputation - could be skipped simply by calling that URL instead. CloudFront
// attaches a secret header on the origin request; only it knows the value.
//
// Inactive when ORIGIN_VERIFY_SECRET is unset, which keeps local development
// and the Render deployment working unchanged. That also makes the rollout
// safe in either order: CloudFront can start sending the header before the
// backend enforces it, or vice versa, without an outage.

const HEADER = 'x-origin-verify';

/** Constant-time compare so a wrong value cannot be found byte by byte. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length - so compare lengths first and still run the check.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function originVerify(req: Request, res: Response, next: NextFunction): void {
  const expected = env.ORIGIN_VERIFY_SECRET;
  if (!expected) {
    next();
    return;
  }

  const provided = req.header(HEADER);
  if (provided && matches(provided, expected)) {
    next();
    return;
  }

  // 403 with no detail: telling the caller which header is missing would
  // hand them the name of the thing to forge.
  res.status(403).json({ success: false, error: 'Forbidden' });
}
