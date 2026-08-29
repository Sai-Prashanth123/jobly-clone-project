import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/cases.service';
import type {
  ListCasesQuery, CreateCaseInput, UpdateCaseInput,
  CreateFilingInput, UpdateFilingInput, CreateNoteInput,
} from '../schemas/case.schema';
import type { UpsertWageInput, UpsertTaxReturnInput } from '../schemas/caseWages.schema';
import type { UpsertPermDetailsInput } from '../schemas/casePerm.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listCases(req.query as unknown as ListCasesQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getCase(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createCase(req.body as CreateCaseInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateCase(req.params.id, req.body as UpdateCaseInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteCase(req.params.id, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function createFiling(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createFiling(req.params.id, req.body as CreateFilingInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateFiling(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateFiling(req.params.id, req.params.filingId, req.body as UpdateFilingInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeFiling(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.removeFiling(req.params.id, req.params.filingId, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function createNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createNote(req.params.id, req.body as CreateNoteInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateNote(req.params.id, req.params.noteId, req.body as CreateNoteInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.removeNote(req.params.id, req.params.noteId, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listCaseDocuments(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    const category = String((req.body as any)?.category ?? '');
    const data = await svc.uploadCaseDocument(req.params.id, file, category, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.removeCaseDocument(req.params.id, req.params.docId, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function listWages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listWages(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function upsertWage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.upsertWage(req.params.id, req.body as UpsertWageInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listTaxReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listTaxReturns(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function upsertTaxReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.upsertTaxReturn(req.params.id, req.body as UpsertTaxReturnInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPermDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getPermDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function upsertPermDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.upsertPermDetails(req.params.id, req.body as UpsertPermDetailsInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function completeStatusStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.completeStatusStep(req.params.id, req.params.stepKey, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
