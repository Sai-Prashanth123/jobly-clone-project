import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/caseMessages.service';
import type { CreateCaseMessageInput } from '../schemas/caseMessage.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listMessages(req.params.id, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createMessage(req.params.id, req.body as CreateCaseMessageInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.markMessageRead(req.params.messageId, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
