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
  // Status is derived server-side from the dates on create (see
  // assignments.service.createAssignment); accepted but ignored if sent.
  status: z.enum(['active','completed','pending','terminated']).optional(),
  billingType: z.enum(['hourly','monthly','milestone']).optional().nullable(),
  workLocation: z.string().optional().nullable().transform(v => v || null),
  reportingManagerId: z.string().uuid().optional().nullable(),
}).refine(
  v => !v.endDate || v.endDate >= v.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

// Partial schemas cannot inherit object-level .refine(), so re-apply the rule
// for updates by checking both fields when both are present.
export const updateAssignmentSchema = z.object({
  employeeId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectName: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable().transform(v => v || null),
  billRate: z.number().min(0).optional(),
  payRate: z.number().min(0).optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).optional(),
  status: z.enum(['active','completed','pending','terminated']).optional(),
  billingType: z.enum(['hourly','monthly','milestone']).optional().nullable(),
  workLocation: z.string().optional().nullable().transform(v => v || null),
  reportingManagerId: z.string().uuid().optional().nullable(),
}).refine(
  v => !(v.startDate && v.endDate) || v.endDate >= v.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

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
