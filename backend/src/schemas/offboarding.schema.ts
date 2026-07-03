import { z } from 'zod';

const CATEGORIES = ['it', 'hr', 'compliance', 'equipment', 'finance', 'general'] as const;

export const createTemplateSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category:    z.enum(CATEGORIES).optional(),
  isRequired:  z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
});

export const updateTemplateSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category:    z.enum(CATEGORIES).optional(),
  isRequired:  z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
  isActive:    z.boolean().optional(),
});

export const createTaskSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category:    z.enum(CATEGORIES).optional(),
  isRequired:  z.boolean().optional(),
  notes:       z.string().max(2000).optional().nullable(),
  dueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  sortOrder:   z.number().int().optional(),
});

// The toggle endpoint (PATCH /tasks/:taskId/toggle) is called with no body —
// it just flips is_completed server-side. Validate that no unexpected fields
// are sent rather than skipping validation entirely.
export const toggleTaskSchema = z.object({}).strict();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateTaskInput     = z.infer<typeof createTaskSchema>;
export type ToggleTaskInput     = z.infer<typeof toggleTaskSchema>;
