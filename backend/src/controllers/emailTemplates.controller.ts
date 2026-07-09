import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/emailTemplates.service';
import type { CreateEmailTemplateInput, UpdateEmailTemplateInput, BulkClientEmailInput } from '../schemas/emailTemplate.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.query.type as 'general' | 'invoice' | undefined;
    res.json({ success: true, data: await svc.listEmailTemplates(type) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.getEmailTemplate(req.params.id) }); } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createEmailTemplate(req.body as CreateEmailTemplateInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateEmailTemplate(req.params.id, req.body as UpdateEmailTemplateInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await svc.deleteEmailTemplate(req.params.id, req.user?.id); res.json({ success: true }); } catch (err) { next(err); }
}

export async function sendBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.bulkSendClientEmail(req.body as BulkClientEmailInput, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
