import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { appErrorFromDbError } from '../lib/dbErrors';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
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
