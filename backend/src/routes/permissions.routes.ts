import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import * as svc from '../services/permissions.service';
import { supabaseAdmin } from '../config/supabase';
import { ValidationError } from '../lib/errors';
import { BUILTIN_ROLES } from '../lib/permissions';

/**
 * The permissions editor's API.
 *
 * Guarded by `admin.view`, which is also the one permission that cannot be
 * revoked from its last holder — so the screen that controls access can never
 * lock out everyone who can reach it.
 */
const router = Router();
router.use(authenticate);

router.get('/', requirePermission('admin.view', 'admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await svc.listForEditor() }); } catch (e) { next(e); }
});

const grantSchema = z.object({
  role_key: z.string().min(1),
  permission_key: z.string().min(1),
  granted: z.boolean(),
});

router.patch(
  '/grant',
  requirePermission('admin.view', 'admin'),
  validateBody(grantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await svc.setGrant(req.body, req.user!.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

const roleSchema = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores'),
  label: z.string().min(1).max(60),
});

router.post(
  '/roles',
  requirePermission('admin.view', 'admin'),
  validateBody(roleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // A custom role is a row here, never a new value on the user_role enum:
      // a Postgres enum value can never be removed, so a role added by mistake
      // would be permanent. portal_users.role stays the enum for the built-ins.
      if ((BUILTIN_ROLES as readonly string[]).includes(req.body.key)) {
        throw new ValidationError(`'${req.body.key}' is a built-in role.`);
      }
      const { error } = await supabaseAdmin
        .from('roles')
        .insert({ key: req.body.key, label: req.body.label, is_builtin: false });
      if (error) throw error;
      svc.invalidate();
      res.status(201).json({ success: true });
    } catch (e) { next(e); }
  },
);

const permissionSchema = z.object({
  key: z.string().min(3).max(80).regex(/^[a-zA-Z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9.-]*$/, 'Use the form area.action'),
  label: z.string().min(1).max(120),
  group_name: z.string().min(1).max(60),
});

router.post(
  '/custom',
  requirePermission('admin.view', 'admin'),
  validateBody(permissionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // is_custom marks a permission no route references yet. It is inert
      // until a developer uses the key — the UI says so on the form, so
      // nobody believes creating one has locked something down.
      const { error } = await supabaseAdmin
        .from('permissions')
        .insert({ ...req.body, is_custom: true });
      if (error) throw error;
      svc.invalidate();
      res.status(201).json({ success: true });
    } catch (e) { next(e); }
  },
);

export default router;
