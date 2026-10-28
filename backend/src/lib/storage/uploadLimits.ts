/**
 * How big an upload may be, and what may be rendered inline.
 *
 * WHY THESE NUMBERS ARE WHAT THEY ARE
 *
 * Uploads used to go browser → API Gateway → Lambda as multipart form data.
 * API Gateway base64-encodes the request body into the Lambda event, inflating
 * it by 4/3, and Lambda's synchronous invoke payload limit is 6,291,456 bytes:
 *
 *     6,291,456 × 3/4 = 4,718,592 bytes ≈ 4.5 MiB
 *
 * So the real ceiling was ~4.5 MiB while three separate places advertised
 * 20 MB. A 7.9 MB passport arrived as ~11 MB of base64 and API Gateway
 * rejected it with its own 413 before Express ever ran — which is why raising
 * the multer limit could never have helped.
 *
 * Files now go straight from the browser to S3 with a presigned PUT, so the
 * bytes never touch Lambda and MAX_UPLOAD_BYTES is a product decision rather
 * than an infrastructure one.
 *
 * IMPORT-FREE ON PURPOSE. Loading the S3 provider pulls in config/env, whose
 * validation calls process.exit(1) when a variable is missing — which kills a
 * test runner. presign.ts carries the same note for the same reason, and the
 * parity test that compares this to the frontend copy depends on it.
 */

/**
 * The advertised maximum, and the real one.
 *
 * 100 MiB covers scanned multi-page passports and photo-heavy Word files with
 * room to spare. Going much past ~250 MB would need chunked multipart upload:
 * a browser buffers the whole body of a single PUT, there is no resume, and
 * one dropped connection means starting from zero.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * What the OLD multer path can actually carry, for the routes still on it.
 *
 * 4 MiB rather than the arithmetic 4.5, to leave room for the multipart
 * boundary, the part headers and a long JWT in the request. The previous
 * value here was 20 MB, which was never achievable.
 */
export const LEGACY_MULTER_MAX_BYTES = 4 * 1024 * 1024;

/** Profile photos stay on the Lambda path — 2 MiB genuinely works there. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Long enough for a slow upload of a large file, short enough to not linger. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * The most we will pull into Lambda memory to render a preview.
 *
 * renderDocument reads the whole object and returns HTML inside a JSON
 * response, and a Lambda response has the same 6 MB limit as a request. With
 * a 100 MiB ceiling on uploads, a large spreadsheet would OOM or produce a
 * response API Gateway refuses — a 500 where the dialog should simply say
 * "Preview not available".
 */
export const RENDER_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Extensions safe to hand a browser to render.
 *
 * Everything else is served with Content-Disposition: attachment, so it
 * downloads instead of executing. This is what makes "accept every file type"
 * safe: an uploaded .html or .svg can carry script, and while S3 serves from
 * a different origin than the portal — so it cannot read a session or call
 * the API as the viewer — it can still host a convincing phishing page on an
 * amazonaws.com URL.
 *
 * SVG is deliberately NOT here. It is an image to most people and a script
 * host to a browser.
 */
export const INLINE_SAFE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] as const;

/** The last extension wins, so "invoice.pdf.html" is correctly treated as HTML. */
export function extensionOf(fileName: string): string {
  const base = (fileName ?? '').split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function isInlineSafe(fileName: string): boolean {
  return (INLINE_SAFE_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

/** "100 MB" — so no screen has to retype the number. */
export function maxUploadLabel(): string {
  return `${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`;
}

export function legacyMulterLabel(): string {
  return `${Math.round(LEGACY_MULTER_MAX_BYTES / (1024 * 1024))} MB`;
}
