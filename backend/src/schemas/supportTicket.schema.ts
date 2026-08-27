import { z } from 'zod';

export const createTicketSchema = z.object({
  caseId: z.string().uuid().optional().nullable().transform(v => v || null),
  employeeId: z.string().uuid().optional().nullable().transform(v => v || null),
  subject: z.string().min(1),
  message: z.string().min(1),
}).refine(v => !!v.caseId || !!v.employeeId, {
  message: 'A support ticket must reference a case or an employee',
  path: ['caseId'],
});

export const resolveTicketSchema = z.object({
  resolution: z.string().min(1),
});

export const listTicketsQuerySchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
