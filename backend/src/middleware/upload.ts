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
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
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
