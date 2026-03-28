import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/invoices.service';
import { exportInvoicesCSV, bulkUpdateInvoiceStatus } from '../services/invoices.service';
import type { ListInvoicesQuery, GenerateInvoiceInput, UpdateInvoiceInput } from '../schemas/invoice.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listInvoices(req.query as unknown as ListInvoicesQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getInvoice(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function generate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.generateInvoice(req.body as GenerateInvoiceInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateInvoice(req.params.id, req.body as UpdateInvoiceInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteInvoice(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const url = await svc.getInvoicePDF(req.params.id);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.sendInvoice(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function exportInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = await exportInvoicesCSV({ status: req.query.status as string, clientId: req.query.clientId as string });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function bulkInvoiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids, status } = req.body as { ids: string[]; status: string };
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ success: false, error: 'ids must be a non-empty array' }); return; }
    if (ids.length > 100) { res.status(400).json({ success: false, error: 'Cannot bulk update more than 100 invoices at once' }); return; }
    const result = await bulkUpdateInvoiceStatus(ids, status);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
