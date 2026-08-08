import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/leaveRequests.service';
import type {
  CreateLeaveRequestInput,
  ReviewLeaveRequestInput,
  ListLeaveRequestsQuery,
} from '../schemas/leaveRequest.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listLeaveRequests(
      req.query as unknown as ListLeaveRequestsQuery,
      req.user!.role,
      req.user!.employeeId,
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getLeaveRequest(req.params.id, req.user!.role, req.user!.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createLeaveRequest(
      req.body as CreateLeaveRequestInput,
      req.user!.role,
      req.user!.employeeId,
      req.user!.id,
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.reviewLeaveRequest(
      req.params.id,
      req.body as ReviewLeaveRequestInput,
      req.user!.id,
      req.user!.role,
      req.user?.employeeId,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.cancelLeaveRequest(req.params.id, req.user!.role, req.user!.employeeId, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
