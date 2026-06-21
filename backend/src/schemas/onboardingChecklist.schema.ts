import { z } from 'zod';

const CATEGORIES = ['it','hr','compliance','equipment','finance','general'] as const;

export const createTemplateSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  category:    z.enum(CATEGORIES).default('general'),
  isRequired:  z.boolean().default(true),
  sortOrder:   z.number().int().default(0),
  isActive:    z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const addCustomTaskSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  category:    z.enum(CATEGORIES).default('general'),
  isRequired:  z.boolean().default(false),
  dueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:       z.string().max(1000).optional().nullable(),
});

export type CreateTemplateInput  = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput  = z.infer<typeof updateTemplateSchema>;
export type AddCustomTaskInput   = z.infer<typeof addCustomTaskSchema>;
