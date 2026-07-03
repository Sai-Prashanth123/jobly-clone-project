import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/assets.service';
import { ForbiddenError } from '../lib/errors';
import type { ListAssetsQuery, CreateAssetInput, UpdateAssetInput, AssignAssetInput } from '../schemas/assets.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listAssets(req.query as unknown as ListAssetsQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getAsset(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getForEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role === 'employee' && req.params.employeeId !== req.user!.employeeId) {
      throw new ForbiddenError('You can only view your own assets.');
    }
    const data = await svc.getEmployeeAssets(req.params.employeeId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createAsset(req.body as CreateAssetInput, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateAsset(req.params.id, req.body as UpdateAssetInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function assign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.assignAsset(req.params.id, req.body as AssignAssetInput, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function unassign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.unassignAsset(req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteAsset(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
