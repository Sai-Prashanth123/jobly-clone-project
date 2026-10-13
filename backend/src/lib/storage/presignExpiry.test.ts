import { describe, it, expect, vi } from 'vitest';
import { MAX_PRESIGNED_SECONDS, clampExpiry } from './presign';

/**
 * Uploading a client-signed timesheet returned a bare 500, over and over:
 *
 *   Signature version 4 presigned URLs must have an expiration date less than
 *   one week in the future
 *
 * Supabase signed URLs had no ceiling, so code ported from it asked for 30
 * days. The AWS SDK does not quietly shorten that — it throws, and the upload
 * is lost. Both the weekly and the monthly proof path carried the same number,
 * so both were broken.
 *
 * Clamping lives in the provider rather than at the call sites: there are two
 * today and there will be more, and a comfortable-sounding number is exactly
 * the kind of thing that gets copied.
 */
describe('presigned URL expiry', () => {
  it('is capped at the AWS maximum of seven days', () => {
    expect(MAX_PRESIGNED_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it('clamps the 30 days that was throwing in production', () => {
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(thirtyDays).toBeGreaterThan(MAX_PRESIGNED_SECONDS);
    expect(clampExpiry(thirtyDays)).toBe(MAX_PRESIGNED_SECONDS);
  });

  it('leaves a legal expiry untouched', () => {
    for (const s of [60, 3600, 24 * 60 * 60, MAX_PRESIGNED_SECONDS]) {
      expect(clampExpiry(s)).toBe(s);
    }
  });

  it('says so in the log rather than silently shortening', () => {
    // A clamp that happens quietly loses the expiry the author intended, and
    // nobody finds out until a link dies early.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clampExpiry(30 * 24 * 60 * 60);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toMatch(/exceeds the AWS maximum/);
    warn.mockRestore();
  });

  it('does not warn for a legal value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clampExpiry(3600);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
