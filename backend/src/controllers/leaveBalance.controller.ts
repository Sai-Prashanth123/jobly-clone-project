import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/leaveBalance.service';
import type { CreateLeaveTypeInput, UpdateLeaveTypeInput, SetEntitlementInput, ListBalancesQuery } from '../schemas/leaveBalance.schema';
import { ForbiddenError } from '../lib/errors';

// ─── Leave Types ─────────────────────────────────────────────────────────────

export async function listTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listLeaveTypes();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createLeaveType(req.body as CreateLeaveTypeInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateLeaveType(req.params.id, req.body as UpdateLeaveTypeInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteLeaveType(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Balances ────────────────────────────────────────────────────────────────

export async function getMyBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.status(400).json({ success: false, error: 'No employee record linked to this account' });
      return;
    }
    const query = req.query as unknown as ListBalancesQuery;
    const data = await svc.getEmployeeBalances(employeeId, query.year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getBalancesForEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ListBalancesQuery;
    const data = await svc.getEmployeeBalances(req.params.empId, query.year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function setEntitlement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.setEntitlement(req.params.empId, req.body as SetEntitlementInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
