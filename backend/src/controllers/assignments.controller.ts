import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/assignments.service';
import type { ListAssignmentsQuery, CreateAssignmentInput, UpdateAssignmentInput } from '../schemas/assignment.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listAssignments(
      req.query as unknown as ListAssignmentsQuery,
      req.user?.role,
      req.user?.id,
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAssignment(req.params.id);
    // An employee may only view their own assignment (bill/pay rates are sensitive).
    // The list endpoint already scopes employees to their own rows; this guards the
    // single-get so an employee can't read another's assignment by UUID.
    if (req.user!.role === 'employee' && data.employee_id !== req.user!.employeeId) {
      res.status(403).json({ success: false, error: 'You may only view your own assignments' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createAssignment(req.body as CreateAssignmentInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateAssignment(req.params.id, req.body as UpdateAssignmentInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteAssignment(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
