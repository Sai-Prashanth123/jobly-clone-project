import { z } from 'zod';

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;

const lineItemSchema = z.object({
  itemName: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
});

const recurringBaseSchema = z.object({
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
  // Coerce '' to null so a blank end-date field doesn't fail the ymd regex
  // with an opaque 400 — the refines below produce the real field errors.
  endDate: z.preprocess(v => (v === '' ? null : v), ymdDate.optional().nullable()),
  maxOccurrences: z.number().int().positive().optional().nullable(),
  autoSend: z.boolean().default(false),
});

// Cross-field rules for the end-of-schedule config. Without these a blank end
// date 400s opaquely, and a blank occurrence count creates a schedule that
// never ends (the cron's pause guard is skipped when max_occurrences is null).
const endModeRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((d: any) => d.endMode !== 'on_date' || !!d.endDate, {
      message: 'End date is required when the schedule ends on a date',
      path: ['endDate'],
    })
    .refine((d: any) => d.endMode !== 'on_date' || !d.endDate || !d.startDate || d.endDate > d.startDate, {
      message: 'End date must be after the start date',
      path: ['endDate'],
    })
    .refine((d: any) => d.endMode !== 'after_count' || (d.maxOccurrences != null && d.maxOccurrences >= 1), {
      message: 'Number of occurrences is required when the schedule ends after N runs',
      path: ['maxOccurrences'],
    });

export const createRecurringSchema = endModeRules(recurringBaseSchema);

export const updateRecurringSchema = endModeRules(recurringBaseSchema.partial().extend({
  status: z.enum(['active', 'paused']).optional(),
}));

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
