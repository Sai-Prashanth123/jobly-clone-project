import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/onboardingChecklist.service';
import type { CreateTemplateInput, UpdateTemplateInput, AddCustomTaskInput } from '../schemas/onboardingChecklist.schema';

export async function listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listTemplates();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createTemplate(req.body as CreateTemplateInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateTemplate(req.params.id, req.body as UpdateTemplateInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteTemplate(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getEmployeeTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getEmployeeTasks(req.params.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function addCustomTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.addCustomTask(req.params.employeeId, req.body as AddCustomTaskInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function toggleTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.toggleTask(req.params.taskId, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
