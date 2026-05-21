import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/employees.service';
import { exportEmployeesCSV } from '../services/employees.service';
import * as storageSvc from '../services/storage.service';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { supabaseAdmin } from '../config/supabase';
import type { ListEmployeesQuery, CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listEmployees(req.query as unknown as ListEmployeesQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Employees may only view their own profile — prevents enumerating other
    // employees' SSN, pay rate, bank details, visa expiry, etc.
    if (req.user!.role === 'employee' && req.user!.employeeId !== req.params.id) {
      throw new ForbiddenError('Employees may only view their own profile');
    }
    const data = await svc.getEmployee(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.createEmployee(req.body as CreateEmployeeInput, req.user?.id);
    // Pull off the internal _credentials channel before responding so we can
    // surface email/login status to HR without leaking the temp password.
    const { _credentials, ...data } = result as any;
    res.status(201).json({
      success: true,
      data,
      welcomeEmailSent: _credentials?.emailSent ?? false,
      warning: _credentials?.warning,
    });
  } catch (err) { next(err); }
}

export async function resendCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.resendCredentials(req.params.id, req.user?.id);
    res.json({
      success: true,
      welcomeEmailSent: result.emailSent,
      warning: result.warning,
      // Include the temp password ONLY when the email failed, so HR can copy it
      // and pass it to the user out-of-band (no point hiding it — they need it).
      tempPassword: result.emailSent ? undefined : result.tempPassword,
      loginEmail: result.loginEmail,
    });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Employees may only edit their own profile — same ownership rule as getOne.
    // This blocks one employee from updating another's pay, visa, status, etc.
    if (req.user!.role === 'employee' && req.user!.employeeId !== req.params.id) {
      throw new ForbiddenError('Employees may only edit their own profile');
    }
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
    // Employees may only upload to their own employee record.
    if (req.user!.role === 'employee' && req.user!.employeeId !== req.params.id) {
      throw new ForbiddenError('Employees may only manage their own documents');
    }
    const { name, docType } = req.body as { name?: string; docType?: string };
    const data = await storageSvc.uploadDocument('employee', req.params.id, file, req.user!.id, name, docType);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Employees may only delete docs that belong to their own employee record.
    if (req.user!.role === 'employee') {
      if (req.user!.employeeId !== req.params.id) {
        throw new ForbiddenError('Employees may only manage their own documents');
      }
      const { data: doc, error } = await supabaseAdmin
        .from('documents')
        .select('entity_type, entity_id')
        .eq('id', req.params.docId)
        .single();
      if (error || !doc) throw new NotFoundError('Document not found');
      if (doc.entity_type !== 'employee' || doc.entity_id !== req.user!.employeeId) {
        throw new ForbiddenError('Document does not belong to this employee');
      }
    }
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
