import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
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
