import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/reports.service';

export async function employeeUtilization(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getEmployeeUtilization();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function visaExpiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const daysAhead = parseInt(req.query.daysAhead as string) || 90;
    const data = await svc.getVisaExpiry(daysAhead);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function missingTimesheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const weekStartDate = req.query.weekStartDate as string;
    if (!weekStartDate) {
      res.status(400).json({ success: false, error: 'weekStartDate is required' });
      return;
    }
    const data = await svc.getMissingTimesheets(weekStartDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function timesheetSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate and endDate are required' });
      return;
    }
    const data = await svc.getTimesheetSummary(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function financialSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getFinancialSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function profitability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getProfitability();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function billingByClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getBillingByClient();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
