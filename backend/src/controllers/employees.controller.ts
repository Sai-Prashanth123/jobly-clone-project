import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/employees.service';
import { exportEmployeesCSV } from '../services/employees.service';
import * as storageSvc from '../services/storage.service';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { supabaseAdmin } from '../config/supabase';
import type { ListEmployeesQuery, CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    const ownId = req.user!.employeeId ?? null;
    // Employees only ever see themselves; everyone else sees the roster but with
    // SSN/bank/pay redacted unless they're admin/hr (or their own row).
    const result = await svc.listEmployees(
      req.query as unknown as ListEmployeesQuery,
      role === 'employee' ? { restrictToEmployeeId: ownId } : undefined,
    );
    result.data = result.data.map((e: any) => svc.redactEmployee(e, role, e.id === ownId));
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
    // Operations/finance see the profile but not SSN/bank/pay; admin/hr and the
    // employee viewing their own record see everything.
    const redacted = svc.redactEmployee(data, req.user!.role, req.user!.employeeId === req.params.id);
    res.json({ success: true, data: redacted });
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

export async function directory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, department } = req.query as { search?: string; department?: string };
    const data = await svc.listDirectory(search, department);
    res.json({ success: true, data });
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
    const result = await svc.updateEmployee(req.params.id, req.body as UpdateEmployeeInput, req.user?.id, req.user?.role);
    // Pull off the internal _credentials channel (only populated when this
    // update changed the employee's personal/work email) before responding.
    const { _credentials, ...data } = result as any;
    res.json({
      success: true,
      data,
      welcomeEmailSent: _credentials?.emailSent ?? false,
      warning: _credentials?.warning,
      tempPassword: _credentials?.emailSent ? undefined : _credentials?.tempPassword,
      loginEmail: _credentials?.loginEmail,
    });
  } catch (err) { next(err); }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.completeOnboarding(req.params.id, req.user!.role, req.user?.employeeId, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function requestOnboardingChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = String((req.body as any)?.message ?? '').trim();
    if (message.length < 1 || message.length > 2000) {
      res.status(400).json({ success: false, error: 'Message must be 1–2000 characters.' });
      return;
    }
    const expectedSubmittedAt = (req.body as any)?.expectedSubmittedAt ?? null;
    const data = await svc.requestOnboardingChanges(req.params.id, message, req.user?.id, expectedSubmittedAt);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function reopenOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.reopenOnboarding(req.params.id, req.user!.role, req.user?.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// Ask an employee (any status) for a document or piece of information
// outside the onboarding flow — e.g. a renewed visa, an updated ID.
export async function requestDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = String((req.body as any)?.message ?? '').trim();
    if (message.length < 1 || message.length > 2000) {
      res.status(400).json({ success: false, error: 'Message must be 1–2000 characters.' });
      return;
    }
    const data = await svc.requestEmployeeDocuments(req.params.id, message, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteEmployee(req.params.id, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function placeOnLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.placeOnExtendedLeave(req.params.id, req.body as any, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function returnFromLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.returnFromLeave(req.params.id, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function terminate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.terminateEmployee(req.params.id, req.body as any, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function rehire(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.rehireEmployee(req.params.id, req.user?.id);
    const { _credentials, ...data } = result as any;
    res.json({
      success: true,
      data,
      welcomeEmailSent: _credentials?.emailSent ?? false,
      warning: _credentials?.warning,
      tempPassword: _credentials?.emailSent ? undefined : _credentials?.tempPassword,
      loginEmail: _credentials?.loginEmail,
    });
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
    const { name, docType, expiryDate } = req.body as { name?: string; docType?: string; expiryDate?: string };
    const data = await storageSvc.uploadDocument('employee', req.params.id, file, req.user!.id, name, docType, expiryDate);
    void svc.notifyDocumentUploadedDuringOnboarding(req.params.id, data); // fire-and-forget, never blocks the response
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    // Employees may only set their own photo.
    if (req.user!.role === 'employee' && req.user!.employeeId !== req.params.id) {
      throw new ForbiddenError('Employees may only update their own photo');
    }
    const profilePhotoUrl = await storageSvc.uploadEmployeePhoto(req.params.id, file);
    res.status(201).json({ success: true, profilePhotoUrl });
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
    const csv = await exportEmployeesCSV({ status: req.query.status as string, department: req.query.department as string, viewerRole: req.user!.role });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function expiringDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = parseInt(req.query.days as string ?? '90', 10);
    const data = await svc.listExpiringDocuments(isNaN(days) ? 90 : days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
