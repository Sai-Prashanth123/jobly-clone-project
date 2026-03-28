import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/admin.service';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listPortalUsers();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.body as { role: string };
    const data = await svc.updateUserRole(req.params.id, role, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deactivateUser(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tempPassword = await svc.resetUserPassword(req.params.id);
    res.json({ success: true, data: { tempPassword } });
  } catch (err) { next(err); }
}

export async function listActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = {
      entityType: req.query.entityType as string | undefined,
      action:     req.query.action as string | undefined,
      actorId:    req.query.actorId as string | undefined,
      page:       parseInt(req.query.page as string) || 1,
      limit:      Math.min(parseInt(req.query.limit as string) || 50, 200),
    };
    const result = await svc.listActivityLogs(query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}
