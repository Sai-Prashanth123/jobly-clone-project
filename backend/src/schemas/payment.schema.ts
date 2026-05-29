import { z } from 'zod';

export const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'cash', 'card', 'other'] as const;

export const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date'),
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
