import multer from 'multer';
import type { Request } from 'express';
import { LEGACY_MULTER_MAX_BYTES, MAX_PHOTO_BYTES } from '../lib/storage/uploadLimits';

/**
 * Multipart uploads that still travel through this server.
 *
 * Most documents no longer do: the browser PUTs them straight to storage and
 * then registers the path, which is what lifted the ceiling from ~4.5 MB to
 * 100 MB. See lib/storage/uploadLimits.ts for the arithmetic behind that
 * number, and why the 20 MB this file used to claim was never achievable.
 *
 * THE MIME WHITELIST IS GONE. Every file type is accepted now. That is safe
 * because of two things that live elsewhere and must stay in place:
 *
 *   lib/storage/contentType.ts   never stores a type a browser will execute —
 *                                .html and .svg become application/octet-stream
 *   storage.service download URLs force Content-Disposition: attachment for
 *                                anything outside INLINE_SAFE_EXTENSIONS
 *
 * Removing the whitelist WITHOUT those two is the one change that would make
 * things worse than before, so they ship together.
 */

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  // The honest limit for this path. API Gateway base64-encodes the body before
  // Lambda sees it, so a 6 MB invoke payload is about 4.5 MB of file; the old
  // 20 MB here could never be reached and a file between the two produced a
  // bare "Request Entity Too Large" from API Gateway before Express ran.
  limits: { fileSize: LEGACY_MULTER_MAX_BYTES },
});

/**
 * Profile photos, which stay on this path deliberately.
 *
 * 2 MB genuinely works through Lambda, and the photo write also clears the
 * previous file from a public bucket — more moving parts to port for no user
 * benefit. This is the one place a type filter still earns its keep: the value
 * is rendered as an <img> everywhere a person appears, so a non-image is
 * simply a broken avatar.
 */
function imagesOnly(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error(`A profile photo must be an image, not ${file.mimetype || 'an unknown type'}`));
}

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES },
  fileFilter: imagesOnly,
});
