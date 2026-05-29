import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/products.service';
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from '../schemas/product.schema';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await svc.listProducts(req.query as unknown as ListProductsQuery);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.createProduct(req.body as CreateProductInput, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await svc.updateProduct(req.params.id, req.body as UpdateProductInput, req.user?.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await svc.deleteProduct(req.params.id, req.user?.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
