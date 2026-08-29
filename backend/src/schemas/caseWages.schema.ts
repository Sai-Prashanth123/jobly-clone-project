import { z } from 'zod';

export const upsertWageSchema = z.object({
  wageYear: z.number().int().min(1900).max(2200),
  salaryReceived: z.number().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
});

export const upsertTaxReturnSchema = z.object({
  taxYear: z.number().int().min(1900).max(2200),
  amount: z.number().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
});

export type UpsertWageInput = z.infer<typeof upsertWageSchema>;
export type UpsertTaxReturnInput = z.infer<typeof upsertTaxReturnSchema>;
