import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/petitioners.service';
import type { CreatePetitionerInput, UpdatePetitionerInput } from '../schemas/petitioner.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.listPetitioners();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getPetitioner(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createPetitioner(req.body as CreatePetitionerInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updatePetitioner(req.params.id, req.body as UpdatePetitionerInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deletePetitioner(req.params.id, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
