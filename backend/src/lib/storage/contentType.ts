import { extensionOf } from './uploadLimits';

/**
 * The Content-Type an uploaded file is STORED with.
 *
 * This is the first of two defences that make "accept every file type" safe.
 * The type returned here is signed into the presigned PUT, so a browser that
 * sends a different one is rejected by S3 with a signature mismatch — the
 * client does not get a say in how its own upload will later be served.
 *
 * Anything that a browser would execute — .html, .svg, .xml and friends — and
 * anything unrecognised resolves to application/octet-stream, which browsers
 * download rather than render. The second defence lives on the way back out,
 * where a download URL carries Content-Disposition: attachment unless the
 * extension is on the inline-safe list.
 *
 * Deliberately a small allowlist rather than a library: the set of things we
 * are willing to let a browser render is short, and should stay short.
 */
const BY_EXTENSION: Record<string, string> = {
  // Rendered inline (see INLINE_SAFE_EXTENSIONS, which must stay a subset).
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',

  // Downloaded, but worth a real type so the OS opens the right application.
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
  rtf: 'application/rtf',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeForFileName(fileName: string): string {
  return BY_EXTENSION[extensionOf(fileName)] ?? DEFAULT_CONTENT_TYPE;
}
