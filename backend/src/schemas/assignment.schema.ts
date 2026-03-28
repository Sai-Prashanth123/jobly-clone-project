import { z } from 'zod';

export const createAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  clientId: z.string().uuid(),
  projectName: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional().nullable().transform(v => v || null),
  billRate: z.number().min(0),
  payRate: z.number().min(0),
  maxHoursPerWeek: z.number().int().min(1).max(168).default(40),
  status: z.enum(['active','completed','pending','terminated']).default('pending'),
  billingType: z.enum(['hourly','monthly','milestone']).optional().nullable(),
  workLocation: z.string().optional().nullable().transform(v => v || null),
  reportingManagerId: z.string().uuid().optional().nullable(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export const listAssignmentsQuerySchema = z.object({
  status: z.enum(['active','completed','pending','terminated']).optional(),
  employeeId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
