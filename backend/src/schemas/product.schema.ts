import { z } from 'zod';

export const PRODUCT_UNITS = ['hour', 'item', 'day', 'fixed'] as const;

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  unitPrice: z.number().min(0).default(0),
  unit: z.enum(PRODUCT_UNITS).default('item'),
  active: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  active: z.preprocess(
    v => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined),
    z.boolean().optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
