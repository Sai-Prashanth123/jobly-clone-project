import { z } from 'zod';

// One row per calendar day of the month. Stored camelCase in the JSONB column.
const monthlyEntrySchema = z.object({
  date: z.string(),                 // YYYY-MM-DD
  dayOfWeek: z.string(),            // 'Mon', 'Tue', …
  project: z.string().default(''),
  task: z.string().default(''),
  startTime: z.string().default(''),  // 'HH:MM'
  endTime: z.string().default(''),
  hours: z.number().min(0).max(24).default(0),
  status: z.enum(['present', 'leave', 'holiday', 'absent', 'weekend']),
});

export const upsertMonthlyTimesheetSchema = z.object({
  employeeId: z.string().uuid().optional(), // ignored for employee role (always self)
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  entries: z.array(monthlyEntrySchema).max(31),
  notes: z.string().optional().nullable(),
  leaveReason: z.string().min(3).max(280).optional().nullable(),
});

export const updateMonthlyTimesheetSchema = z.object({
  entries: z.array(monthlyEntrySchema).max(31),
  notes: z.string().optional().nullable(),
  leaveReason: z.string().min(3).max(280).optional().nullable(),
});

// Admin/HR direct entry edit (PATCH /:id/entries) — entries + optional notes;
// leaveReason is untouched by this endpoint.
export const patchEntriesSchema = z.object({
  entries: z.array(monthlyEntrySchema).max(31),
  notes: z.string().optional().nullable(),
});

// Submission is handled by the dedicated /submit endpoint; this one is review-only.
export const patchMonthlyStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export const listMonthlyTimesheetsQuerySchema = z.object({
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type MonthlyTimesheetEntryInput = z.infer<typeof monthlyEntrySchema>;
export type UpsertMonthlyTimesheetInput = z.infer<typeof upsertMonthlyTimesheetSchema>;
export type UpdateMonthlyTimesheetInput = z.infer<typeof updateMonthlyTimesheetSchema>;
export type PatchEntriesInput = z.infer<typeof patchEntriesSchema>;
export type PatchMonthlyStatusInput = z.infer<typeof patchMonthlyStatusSchema>;
export type ListMonthlyTimesheetsQuery = z.infer<typeof listMonthlyTimesheetsQuerySchema>;
