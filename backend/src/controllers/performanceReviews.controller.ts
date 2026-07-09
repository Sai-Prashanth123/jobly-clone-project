import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/performanceReviews.service';
import { ForbiddenError } from '../lib/errors';
import type {
  CreatePerformanceReviewInput, UpdatePerformanceReviewInput, ListPerformanceReviewsQuery, SendPerformanceReviewInput,
} from '../schemas/performanceReviews.schema';

// Employees may only ever see their own reviews; admin/hr see everything
// (optionally filtered to one employee via ?employeeId=).
function scopedEmployeeId(req: Request): string | undefined {
  if (req.user!.role === 'employee') return req.user!.employeeId ?? '__none__';
  return (req.query.employeeId as string) || undefined;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ListPerformanceReviewsQuery;
    const employeeId = scopedEmployeeId(req);
    const result = await svc.listPerformanceReviews({ ...query, employeeId });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await svc.getPerformanceReview(req.params.id);
    if (req.user!.role === 'employee' && review.employee_id !== req.user!.employeeId) {
      throw new ForbiddenError('You do not have access to this review.');
    }
    res.json({ success: true, data: review });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createPerformanceReview(req.body as CreatePerformanceReviewInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updatePerformanceReview(req.params.id, req.body as UpdatePerformanceReviewInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deletePerformanceReview(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await svc.getPerformanceReview(req.params.id);
    if (req.user!.role === 'employee' && review.employee_id !== req.user!.employeeId) {
      throw new ForbiddenError('You do not have access to this review.');
    }
    const url = await svc.getPerformanceReviewPdf(req.params.id);
    res.json({ success: true, url });
  } catch (err) { next(err); }
}

export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { recipientEmail } = req.body as SendPerformanceReviewInput;
    const result = await svc.sendPerformanceReviewToEmployee(req.params.id, recipientEmail);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}
