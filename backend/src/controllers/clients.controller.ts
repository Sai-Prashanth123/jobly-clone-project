import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/clients.service';
import * as storageSvc from '../services/storage.service';
import type { ListClientsQuery, CreateClientInput, UpdateClientInput } from '../schemas/client.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listClients(req.query as unknown as ListClientsQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.getClient(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createClient(req.body as CreateClientInput);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateClient(req.params.id, req.body as UpdateClientInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function uploadDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: 'No file provided' }); return; }
    const data = await storageSvc.uploadDocument('client', req.params.id, file, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
