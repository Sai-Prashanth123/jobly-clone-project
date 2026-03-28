import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Role '${req.user.role}' is not authorized for this action`));
      return;
    }
    next();
  };
}
