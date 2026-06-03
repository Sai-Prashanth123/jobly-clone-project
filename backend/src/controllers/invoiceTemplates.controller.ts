import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/invoiceTemplates.service';
import type { CreateInvoiceTemplateInput, UpdateInvoiceTemplateInput } from '../schemas/invoiceTemplate.schema';

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await svc.listInvoiceTemplates() }); } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createInvoiceTemplate(req.body as CreateInvoiceTemplateInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateInvoiceTemplate(req.params.id, req.body as UpdateInvoiceTemplateInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await svc.deleteInvoiceTemplate(req.params.id); res.json({ success: true }); } catch (err) { next(err); }
}
