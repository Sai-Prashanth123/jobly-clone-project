import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/invoices.service';
import { exportInvoicesCSV, bulkUpdateInvoiceStatus } from '../services/invoices.service';
import * as paymentsSvc from '../services/payments.service';
import type { ListInvoicesQuery, GenerateInvoiceInput, CreateInvoiceInput, UpdateInvoiceInput } from '../schemas/invoice.schema';
import type { CreatePaymentInput } from '../schemas/payment.schema';

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

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createInvoice(req.body as CreateInvoiceInput, req.user?.id);
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
    // Audit every PDF download so finance has a trail of who accessed which
    // invoice and when (#12 edge-case audit). Best-effort import to avoid a
    // circular dep with services.
    void import('../lib/activityLogger').then(({ logActivity }) =>
      logActivity(req.user?.id ?? null, 'downloaded_pdf', 'invoice', req.params.id, req.params.id.slice(0, 8)),
    );
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.sendInvoice(req.params.id);
    res.json({
      success: true,
      data: result.invoice,
      emailSent: result.emailSent,
      warning: result.warning,
    });
  } catch (err) { next(err); }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    const data = await svc.addInvoiceAttachment(req.params.id, file, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.removeInvoiceAttachment(req.params.id, req.params.docId);
    res.json({ success: true });
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

export async function getPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getPublicInvoice(req.params.token);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function convert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.convertEstimate(req.params.id, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await paymentsSvc.listPayments(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await paymentsSvc.recordPayment(req.params.id, req.body as CreatePaymentInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await paymentsSvc.deletePayment(req.params.paymentId, req.user?.id);
    res.json({ success: true });
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
