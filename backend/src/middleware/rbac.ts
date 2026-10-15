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

/**
 * Guard a route by PERMISSION rather than by a hardcoded role list.
 *
 * The same answer as `requireRole`, asked a different way: `requireRole`
 * states who may do a thing, `requirePermission` looks up whether this role
 * may — so an admin can change it from a screen without a deploy.
 *
 * `roles` is the compiled-in answer for this key, and it is required rather
 * than optional on purpose. If the permission tables are empty, unreachable,
 * or silent about this key, that list is what applies — so a database problem
 * degrades to exactly today's behaviour instead of becoming an outage (every
 * route 403) or a free-for-all (every route open). It also keeps the old rule
 * readable at the call site while the swap is in progress, which matters when
 * 256 routes are moving a file at a time.
 *
 * The lookup is cached for ten seconds in permissions.service, so this costs
 * nothing per request in practice while still taking effect on the next call
 * rather than the next login.
 */
export function requirePermission(key: string, ...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }
    try {
      // Imported lazily: config/supabase validates env on import, and rbac is
      // pulled in by every route file including those a test may load without
      // a database.
      const { may } = await import('../services/permissions.service');
      if (await may(req.user.role, key)) { next(); return; }
      next(new ForbiddenError(`Role '${req.user.role}' is not authorized for this action`));
    } catch (err) {
      // Never let a lookup failure decide authorisation. Fall back to the
      // compiled-in list, which is what this route enforced before any of
      // this existed.
      console.error('[requirePermission] lookup failed; using the compiled-in roles', { key, err });
      if (roles.includes(req.user.role)) { next(); return; }
      next(new ForbiddenError(`Role '${req.user.role}' is not authorized for this action`));
    }
  };
}
