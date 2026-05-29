import { z } from 'zod';

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;

const lineItemSchema = z.object({
  itemName: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
});

export const createRecurringSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().max(200).optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
  taxRate: z.number().min(0).max(100).default(0),
  poNumber: z.string().max(100).optional().nullable(),
  currency: z.string().max(8).default('USD'),
  paymentTerms: z.enum(['on_receipt', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60']).default('net_30'),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: ymdDate,
  endMode: z.enum(['never', 'on_date', 'after_count']).default('never'),
  endDate: ymdDate.optional().nullable(),
  maxOccurrences: z.number().int().positive().optional().nullable(),
  autoSend: z.boolean().default(false),
});

export const updateRecurringSchema = createRecurringSchema.partial().extend({
  status: z.enum(['active', 'paused']).optional(),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
