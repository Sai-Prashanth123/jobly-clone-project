import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/announcements.service';
import { supabaseAdmin } from '../config/supabase';
import type { ListAnnouncementsQuery, CreateAnnouncementInput, UpdateAnnouncementInput } from '../schemas/announcements.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    const result = await svc.listAnnouncements(req.query as unknown as ListAnnouncementsQuery, role);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAnnouncement(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createAnnouncement(req.body as CreateAnnouncementInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateAnnouncement(req.params.id, req.body as UpdateAnnouncementInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteAnnouncement(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data: pu } = await supabaseAdmin
      .from('portal_users')
      .select('announcements_last_viewed_at')
      .eq('id', req.user!.id)
      .single();
    const count = await svc.getAnnouncementUnreadCount(
      req.user!.role,
      (pu as any)?.announcements_last_viewed_at ?? null,
    );
    res.json({ count });
  } catch (err) { next(err); }
}

export async function markSeen(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.markAnnouncementsSeen(req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
