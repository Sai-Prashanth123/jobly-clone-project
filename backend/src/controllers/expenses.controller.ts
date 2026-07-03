import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/expenses.service';
import type { ListExpensesQuery, CreateExpenseInput, UpdateExpenseInput, ReviewExpenseInput } from '../schemas/expenses.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listExpenses(
      req.query as unknown as ListExpensesQuery,
      req.user!.role,
      req.user!.employeeId,
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getExpense(req.params.id, req.user?.role, req.user?.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employeeId = req.body.employeeId ?? req.user!.employeeId;
    const data = await svc.createExpense(req.body as CreateExpenseInput, employeeId, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateExpense(
      req.params.id,
      req.body as UpdateExpenseInput,
      req.user!.id,
      req.user!.role,
      req.user!.employeeId,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.submitExpense(req.params.id, req.user!.id, req.user!.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.reviewExpense(req.params.id, req.body as ReviewExpenseInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function markPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.markPaid(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteExpense(req.params.id, req.user!.id, req.user!.role, req.user!.employeeId);
    res.json({ success: true });
  } catch (err) { next(err); }
}
