import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/enrollmentForms.service';
import { ForbiddenError } from '../lib/errors';
import type {
  CreateEnrollmentFormInput, UpdateEnrollmentFormInput, SubmitEnrollmentFormInput, ListEnrollmentFormsQuery,
} from '../schemas/enrollmentForms.schema';

// Employees may only ever see their own form(s); admin/hr see everything
// (optionally filtered to one employee via ?employeeId=).
function scopedEmployeeId(req: Request): string | undefined {
  if (req.user!.role === 'employee') return req.user!.employeeId ?? '__none__';
  return (req.query.employeeId as string) || undefined;
}

function assertOwnsOrStaff(req: Request, form: { employee_id: string }): void {
  if (req.user!.role === 'employee' && form.employee_id !== req.user!.employeeId) {
    throw new ForbiddenError('You do not have access to this enrollment form.');
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ListEnrollmentFormsQuery;
    const employeeId = scopedEmployeeId(req);
    const result = await svc.listEnrollmentForms({ ...query, employeeId });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const form = await svc.getEnrollmentForm(req.params.id);
    assertOwnsOrStaff(req, form);
    res.json({ success: true, data: form });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createEnrollmentForm(req.body as CreateEnrollmentFormInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const form = await svc.getEnrollmentForm(req.params.id);
    assertOwnsOrStaff(req, form);
    const data = await svc.updateEnrollmentForm(req.params.id, req.body as UpdateEnrollmentFormInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const form = await svc.getEnrollmentForm(req.params.id);
    assertOwnsOrStaff(req, form);
    const data = await svc.submitEnrollmentForm(req.params.id, req.body as SubmitEnrollmentFormInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteEnrollmentForm(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const form = await svc.getEnrollmentForm(req.params.id);
    assertOwnsOrStaff(req, form);
    const url = await svc.getEnrollmentFormPdf(req.params.id);
    res.json({ success: true, url });
  } catch (err) { next(err); }
}
