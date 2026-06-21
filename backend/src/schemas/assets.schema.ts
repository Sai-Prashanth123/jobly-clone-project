import { z } from 'zod';

const CATEGORIES  = ['laptop','desktop','monitor','phone','tablet','badge','vehicle','software_license','other'] as const;
const CONDITIONS  = ['new','good','fair','poor','damaged'] as const;
const STATUSES    = ['available','assigned','maintenance','retired','lost'] as const;

export const createAssetSchema = z.object({
  name:           z.string().min(1).max(200),
  category:       z.enum(CATEGORIES),
  brand:          z.string().max(100).optional().nullable(),
  model:          z.string().max(100).optional().nullable(),
  serialNumber:   z.string().max(100).optional().nullable(),
  condition:      z.enum(CONDITIONS).default('good'),
  status:         z.enum(STATUSES).default('available'),
  purchaseDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  purchasePrice:  z.number().positive().optional().nullable(),
  warrantyExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const assignAssetSchema = z.object({
  employeeId: z.string().uuid(),
});

export const listAssetsQuerySchema = z.object({
  status:     z.enum([...STATUSES, 'all']).default('all'),
  category:   z.enum([...CATEGORIES, 'all']).default('all'),
  employeeId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAssetInput    = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput    = z.infer<typeof updateAssetSchema>;
export type AssignAssetInput    = z.infer<typeof assignAssetSchema>;
export type ListAssetsQuery     = z.infer<typeof listAssetsQuerySchema>;
