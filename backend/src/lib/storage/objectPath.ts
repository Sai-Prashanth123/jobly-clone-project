import { randomBytes } from 'node:crypto';

/**
 * Storage keys for uploaded files.
 *
 * Every upload site used to build its own key as
 * `${id}/${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
 * and pass `upsert: false`, which asks S3 for `IfNoneMatch: '*'` — a hard
 * failure if the key already exists.
 *
 * A millisecond is not enough to make that unique. The onboarding wizard
 * uploads every staged document in one `Promise.all`, so a dozen requests hit
 * Lambda at once; two with the same filename landing in the same millisecond
 * produce the same key, and one comes back
 * `PreconditionFailed: At least one of the pre-conditions you specified did
 * not hold` — a 500 to the browser and a document that was never stored. That
 * is what left an employee looking at a 100%-complete checklist while the
 * server kept answering "Still required: Insurance Waiver Form".
 *
 * Adding randomness removes the collision rather than the guard: `upsert:
 * false` stays, and still means what it was meant to mean — never silently
 * replace an existing object — but can no longer fire by accident, because a
 * key already carrying a timestamp was never a deliberate overwrite anyway.
 */

/**
 * Strip everything but alphanumerics/dot/dash/underscore (including slashes
 * and "..") so a crafted originalname cannot inject extra path segments into
 * the storage key.
 */
export function safeFileName(originalName: string): string {
  // Capped because an S3 key is bounded at 1024 bytes and a browser will
  // happily send a filename longer than that. Two of the five call sites
  // already did this and three did not.
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/**
 * A storage key under `prefix` that no concurrent upload can collide with.
 *
 * The timestamp is kept because it makes a raw bucket listing readable in
 * date order; the random component is what actually guarantees uniqueness.
 */
export function uniqueObjectPath(prefix: string, originalName: string): string {
  const unique = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  return `${prefix.replace(/\/+$/, '')}/${unique}-${safeFileName(originalName)}`;
}
