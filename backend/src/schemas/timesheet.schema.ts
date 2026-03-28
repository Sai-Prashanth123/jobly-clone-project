import { z } from 'zod';

const timesheetEntrySchema = z.object({
  entryDate: z.string(),
  dayOfWeek: z.string(),
  hours: z.number().min(0).max(24),
  isBillable: z.boolean().default(true),
});

export const createTimesheetSchema = z.object({
  employeeId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  clientId: z.string().uuid(),
  weekStartDate: z.string(),
  weekEndDate: z.string(),
  entries: z.array(timesheetEntrySchema).max(7),
  notes: z.string().optional().nullable(),
});

export const updateTimesheetSchema = z.object({
  entries: z.array(timesheetEntrySchema).max(7),
  notes: z.string().optional().nullable(),
});

export const patchTimesheetStatusSchema = z.object({
  status: z.enum(['submitted','manager_approved','client_approved','rejected']),
  rejectionReason: z.string().optional(),
});

export const listTimesheetsQuerySchema = z.object({
  status: z.enum(['draft','submitted','manager_approved','client_approved','rejected']).optional(),
  employeeId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  weekStartDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;
export type UpdateTimesheetInput = z.infer<typeof updateTimesheetSchema>;
export type PatchTimesheetStatusInput = z.infer<typeof patchTimesheetStatusSchema>;
export type ListTimesheetsQuery = z.infer<typeof listTimesheetsQuerySchema>;
