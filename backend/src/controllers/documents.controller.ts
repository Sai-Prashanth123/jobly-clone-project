import { Request, Response, NextFunction } from 'express';
import * as storageSvc from '../services/storage.service';

export async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.body as { entityType: 'employee' | 'client' | 'invoice'; entityId: string };
    const file = req.file;

    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    if (!entityType || !entityId) {
      res.status(400).json({ success: false, error: 'entityType and entityId are required' });
      return;
    }

    const data = await storageSvc.uploadDocument(entityType, entityId, file, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const url = await storageSvc.getDocumentSignedUrl(req.params.id);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await storageSvc.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
