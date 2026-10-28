import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';
import { legacyMulterLabel } from '../lib/storage/uploadLimits';
import { appErrorFromDbError } from '../lib/dbErrors';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Multer first, and deliberately BEFORE appErrorFromDbError: that classifier
  // switches on `err.code`, and a MulterError's code is a string
  // ('LIMIT_FILE_SIZE') rather than a SQLSTATE, so letting it reach the
  // classifier risks a database-shaped answer to an upload problem.
  //
  // Without this branch an oversize file through a multipart route became an
  // opaque 500. The honest numbers matter here: these routes genuinely cannot
  // carry more than ~4.5 MB, because API Gateway base64-encodes the body
  // before Lambda sees it.
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    const message = tooBig
      ? `That file is too large for this upload. The limit here is ${legacyMulterLabel()}.`
      : `That upload could not be accepted (${err.code}).`;
    console.warn(`[upload] ${req.method} ${req.path}: ${err.code} ${err.message}`);
    res.status(tooBig ? 413 : 400).json({ success: false, error: message });
    return;
  }

  // A fileFilter rejection is a plain Error, not a MulterError — the only one
  // left is photoUpload's images-only check, whose message is already written
  // for the person reading it.
  if (err instanceof Error && /must be an image/.test(err.message)) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  // The services throw raw PgrestError objects in ~128 places. They are not
  // AppError — not even Error — so without this every database failure became
  // an opaque 500, including ordinary things like a duplicate email, which
  // should be a 409 the form can show on the field. Classifying by SQLSTATE
  // here fixes all of those call sites at once.
  const fromDb = err instanceof AppError ? null : appErrorFromDbError(err);
  if (fromDb) {
    // Still log it: a 409 is the right answer for the caller, but the
    // underlying constraint violation is worth having in CloudWatch.
    console.warn(`[DB] ${req.method} ${req.path}:`, (err as { code?: string }).code, (err as Error).message);
    res.status(fromDb.statusCode).json({
      success: false,
      error: fromDb.message,
      ...(fromDb.details && { details: fromDb.details }),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details && { details: err.details }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack, details: err.message }),
  });
}
