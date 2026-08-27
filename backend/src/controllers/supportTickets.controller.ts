import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/supportTickets.service';
import type { ListTicketsQuery, CreateTicketInput, ResolveTicketInput } from '../schemas/supportTicket.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listTickets(req.query as unknown as ListTicketsQuery, req.user!.role, req.user!.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTicket(req.params.id, req.user!.role, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createTicket(req.body as CreateTicketInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.resolveTicket(req.params.id, req.body as ResolveTicketInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
