/**
 * How long a presigned download URL may live.
 *
 * Supabase signed URLs had no ceiling, so code ported from it asked for 30
 * days. AWS caps a SigV4 presigned URL at seven, and the SDK does not quietly
 * shorten an over-long request — it throws:
 *
 *   Signature version 4 presigned URLs must have an expiration date less than
 *   one week in the future
 *
 * which reached the user as a bare 500 every time they tried to upload a
 * client-signed timesheet, weekly and monthly alike.
 *
 * Deliberately free of imports so it can be unit-tested without the env
 * validation that loading the S3 provider performs (and exits on) — the same
 * reason objectPath.ts sits beside it.
 */

/** The longest life AWS allows a SigV4 presigned URL: seven days. */
export const MAX_PRESIGNED_SECONDS = 7 * 24 * 60 * 60;

/**
 * Bring an over-long expiry back inside the AWS limit.
 *
 * Clamping rather than throwing, because a download link that lives for a week
 * is far better than a 500 — but it warns, since a silent clamp loses the
 * expiry the author meant and nobody finds out until a link dies early.
 */
export function clampExpiry(seconds: number): number {
  if (seconds > MAX_PRESIGNED_SECONDS) {
    console.warn(
      `[s3] presigned URL expiry ${seconds}s exceeds the AWS maximum; using ${MAX_PRESIGNED_SECONDS}s`,
    );
    return MAX_PRESIGNED_SECONDS;
  }
  return seconds;
}
