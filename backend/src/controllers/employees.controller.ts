import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/employees.service';
import { exportEmployeesCSV } from '../services/employees.service';
import * as storageSvc from '../services/storage.service';
import type { ListEmployeesQuery, CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listEmployees(req.query as unknown as ListEmployeesQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getEmployee(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createEmployee(req.body as CreateEmployeeInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateEmployee(req.params.id, req.body as UpdateEmployeeInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteEmployee(req.params.id, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function assignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getEmployeeAssignments(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function timesheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getEmployeeTimesheets(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    const { name, docType } = req.body as { name?: string; docType?: string };
    const data = await storageSvc.uploadDocument('employee', req.params.id, file, req.user!.id, name, docType);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await storageSvc.deleteDocument(req.params.docId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function exportEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = await exportEmployeesCSV({ status: req.query.status as string, department: req.query.department as string });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}
