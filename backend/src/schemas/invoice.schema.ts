import { z } from 'zod';

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

export const generateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  timesheetIds: z.array(z.string().uuid()).min(1),
  issueDate: ymdDate,
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['draft','sent','paid','overdue']).optional(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
});

export const listInvoicesQuerySchema = z.object({
  status: z.enum(['draft','sent','paid','overdue']).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
