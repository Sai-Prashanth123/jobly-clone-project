import { z } from 'zod';

const DOCUMENT_TYPES = ['W2', '1099', 'other'] as const;

export const createTaxDocumentSchema = z.object({
  employeeId:   z.string().uuid(),
  taxYear:      z.number().int().min(2000).max(2100),
  documentType: z.enum(DOCUMENT_TYPES),
  fileUrl:      z.string().max(2000).optional().nullable(),
  notes:        z.string().max(2000).optional().nullable(),
});

export const updateTaxDocumentSchema = z.object({
  fileUrl: z.string().max(2000).optional().nullable(),
  notes:   z.string().max(2000).optional().nullable(),
  sentAt:  z.string().optional(),
});

export type CreateTaxDocumentInput = z.infer<typeof createTaxDocumentSchema>;
export type UpdateTaxDocumentInput = z.infer<typeof updateTaxDocumentSchema>;
