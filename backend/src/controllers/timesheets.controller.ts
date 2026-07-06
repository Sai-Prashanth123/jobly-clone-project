import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/timesheets.service';
import { exportTimesheetsCSV, bulkPatchTimesheetStatus } from '../services/timesheets.service';
import { getLeaveCoverage } from '../services/conflicts.service';
import type {
  ListTimesheetsQuery, CreateTimesheetInput,
  UpdateTimesheetInput, PatchTimesheetStatusInput, ReopenTimesheetInput,
} from '../schemas/timesheet.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listTimesheets(
      req.query as unknown as ListTimesheetsQuery,
      req.user?.role,
      req.user?.id,
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getTimesheet(req.params.id, req.user?.role, req.user?.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// Per-date approved/pending leave coverage for this timesheet's week — drives the
// grid's "On leave" overlay and the pre-submit conflict check on the frontend.
export async function leaveCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ts = await svc.getTimesheet(req.params.id);
    const coverage = await getLeaveCoverage(ts.employee_id, ts.week_start_date, ts.week_end_date);
    const leaveDays: Record<string, { status: string; leaveDisplayId: string; leaveType: string }> = {};
    for (const [date, ref] of coverage) {
      leaveDays[date] = { status: ref.status, leaveDisplayId: ref.leaveDisplayId, leaveType: ref.leaveType };
    }
    res.json({ success: true, leaveDays });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createTimesheet(req.body as CreateTimesheetInput, req.user?.role);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadClientProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded' }); return; }
    const data = await svc.uploadWeeklyClientProof(
      req.params.id, req.file, req.user!.role, req.user?.employeeId ?? null, req.user?.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteClientProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.deleteWeeklyClientProof(
      req.params.id, req.user!.role, req.user?.employeeId ?? null, req.user?.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateTimesheet(req.params.id, req.body as UpdateTimesheetInput, req.user?.role, req.user?.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function patchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.patchTimesheetStatus(
      req.params.id,
      req.body as PatchTimesheetStatusInput,
      req.user!.role,
      req.user?.id,
      req.user?.employeeId,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function reopen(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.reopenTimesheet(
      req.params.id,
      req.user!.role,
      req.user?.id,
      (req.body as ReopenTimesheetInput).reason,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteTimesheet(req.params.id, req.user!.role, req.user!.id, req.user?.employeeId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function exportTimesheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = await exportTimesheetsCSV({
      status: req.query.status as string,
      employeeId: req.query.employeeId as string,
      clientId: req.query.clientId as string,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="timesheets-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function patchHrNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.patchHrNotes(req.params.id, req.body.hrNotes ?? null, req.user!.role);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function bulkTimesheetStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids, status } = req.body as { ids: string[]; status: string };
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ success: false, error: 'ids must be a non-empty array' }); return; }
    if (ids.length > 50) { res.status(400).json({ success: false, error: 'Cannot bulk update more than 50 timesheets at once' }); return; }
    const result = await bulkPatchTimesheetStatus(ids, status, req.user!.role);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
