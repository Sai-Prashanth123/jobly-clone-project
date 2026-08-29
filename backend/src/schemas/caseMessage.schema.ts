import { z } from 'zod';

export const CASE_MESSAGE_AUDIENCES = ['all', 'law_firm', 'beneficiary'] as const;

export const createCaseMessageSchema = z.object({
  body: z.string().min(1),
  audience: z.enum(CASE_MESSAGE_AUDIENCES),
});

export type CreateCaseMessageInput = z.infer<typeof createCaseMessageSchema>;
