import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new ValidationError(messages));
      } else {
        next(err);
      }
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new ValidationError(messages));
      } else {
        next(err);
      }
    }
  };
}
