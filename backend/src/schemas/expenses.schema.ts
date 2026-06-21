import { z } from 'zod';

const CATEGORIES = ['travel','meals','accommodation','office_supplies','equipment','training','other'] as const;
const STATUSES   = ['draft','submitted','approved','rejected','paid'] as const;

export const createExpenseSchema = z.object({
  title:       z.string().min(1).max(200),
  category:    z.enum(CATEGORIES),
  amount:      z.number().positive(),
  currency:    z.string().length(3).default('USD'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:       z.string().max(2000).optional().nullable(),
  receiptUrl:  z.string().url().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const reviewExpenseSchema = z.object({
  action:          z.enum(['approved','rejected']),
  rejectionReason: z.string().max(1000).optional().nullable(),
});

export const listExpensesQuerySchema = z.object({
  status:     z.enum([...STATUSES, 'all']).default('all'),
  employeeId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
});

export type CreateExpenseInput      = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput      = z.infer<typeof updateExpenseSchema>;
export type ReviewExpenseInput      = z.infer<typeof reviewExpenseSchema>;
export type ListExpensesQuery       = z.infer<typeof listExpensesQuerySchema>;
