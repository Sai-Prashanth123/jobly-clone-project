import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/notifications.service';


export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listNotifications(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await svc.getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.markRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.markAllRead(req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function triggerTimesheetReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.triggerTimesheetReminders();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function triggerContractExpiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.triggerContractExpiryAlerts();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function triggerInvoiceReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.triggerInvoiceReadinessReminders();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
