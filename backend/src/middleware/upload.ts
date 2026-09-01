import multer from 'multer';
import type { Request } from 'express';

// Whitelist of accepted MIME types. Rejects executables, archives, scripts,
// macros, etc. Keep this narrow — relax only when there's a real document type
// to support (and add tests).
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  // Some Windows setups report .doc/.docx as a generic/empty mimetype
  // (e.g. application/octet-stream) instead of the real Word MIME type —
  // fall back to a filename-extension check so those uploads aren't wrongly
  // rejected server-side even after the frontend now lets them through.
  const hasWordExtension = /\.docx?$/i.test(file.originalname);
  if (ALLOWED_MIME_TYPES.has(file.mimetype) || hasWordExtension) {
    cb(null, true);
  } else {
    // multer aborts the upload and surfaces this via the route's next(err) chain
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
}

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter,
});
