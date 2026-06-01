import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/monthlyTimesheets.service';
import { getLeaveCoverage } from '../services/conflicts.service';
import type {
  UpsertMonthlyTimesheetInput, UpdateMonthlyTimesheetInput, PatchMonthlyStatusInput,
  ListMonthlyTimesheetsQuery,
} from '../schemas/monthlyTimesheet.schema';

// Per-date approved/pending leave coverage for a (year, month) — drives the
// monthly attendance leave overlay + the present-on-leave submit guard. Works
// before the sheet is saved (keyed by year/month, not by sheet id).
export async function leaveCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'Valid year and month are required.' });
      return;
    }
    const employeeId = req.user!.role === 'employee'
      ? req.user!.employeeId
      : ((req.query.employeeId as string) || req.user!.employeeId);
    if (!employeeId) { res.json({ success: true, leaveDays: {} }); return; }
    const mm = String(month).padStart(2, '0');
    const start = `${year}-${mm}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    const coverage = await getLeaveCoverage(employeeId, start, end);
    const leaveDays: Record<string, { status: string; leaveDisplayId: string; leaveType: string }> = {};
    for (const [date, ref] of coverage) {
      leaveDays[date] = { status: ref.status, leaveDisplayId: ref.leaveDisplayId, leaveType: ref.leaveType };
    }
    res.json({ success: true, leaveDays });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listMonthlyTimesheets(
      req.query as unknown as ListMonthlyTimesheetsQuery,
      req.user?.role,
      req.user?.id,
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getMyMonth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) { res.status(400).json({ success: false, error: 'year and month are required' }); return; }
    // Admin/HR may load any employee's month (to fill on their behalf); everyone
    // else is scoped to their own linked employee record.
    const requested = req.query.employeeId as string | undefined;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'hr';
    const employeeId = (isStaff && requested) ? requested : req.user?.employeeId;
    const data = await svc.getMyMonth(employeeId, year, month);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getMonthlyTimesheet(req.params.id);
    // Employees may view their own sheet, or one belonging to a direct report
    // (so a reporting manager can review).
    if (req.user!.role === 'employee' && data.employee_id !== req.user!.employeeId) {
      const isMgr = await svc.isReportingManagerOf(req.user!.employeeId, data.employee_id);
      if (!isMgr) {
        res.status(403).json({ success: false, error: 'You may only view your own timesheet' });
        return;
      }
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.upsertMonthlyTimesheet(
      req.body as UpsertMonthlyTimesheetInput,
      req.user!.role,
      req.user?.employeeId ?? null,
      req.user?.id,
    );
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateMonthlyTimesheet(
      req.params.id, req.body as UpdateMonthlyTimesheetInput, req.user!.role, req.user?.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { row, emailSent, warning } = await svc.submitMonthlyTimesheet(
      req.params.id, req.user!.role, req.user!.id, req.user?.employeeId ?? null,
    );
    res.json({ success: true, data: row, emailSent, warning });
  } catch (err) { next(err); }
}

export async function patchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.patchMonthlyStatus(
      req.params.id, req.body as PatchMonthlyStatusInput, req.user!.role, req.user!.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadClientProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded' }); return; }
    const data = await svc.uploadMonthlyClientProof(
      req.params.id, req.file, req.user!.role, req.user?.employeeId ?? null, req.user?.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteClientProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.deleteMonthlyClientProof(
      req.params.id, req.user!.role, req.user?.employeeId ?? null, req.user?.id,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await svc.getMonthlyTimesheet(req.params.id);
    if (req.user!.role === 'employee' && row.employee_id !== req.user!.employeeId) {
      const isMgr = await svc.isReportingManagerOf(req.user!.employeeId, row.employee_id);
      if (!isMgr) {
        res.status(403).json({ success: false, error: 'You may only download your own timesheet' });
        return;
      }
    }
    const url = await svc.getMonthlyTimesheetPDF(req.params.id);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}
