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
  status: z.enum(['present', 'leave', 'holiday', 'absent', 'weekend', 'none']),
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

// Yearly PDF export — the frontend already assembles accurate, complete data
// for all 12 months (real saved entries where they exist, auto-filled from
// holidays/leave/weekly-timesheet-hours/assignment otherwise, same as the
// existing "Download Year (CSV)" export) and sends it here purely for PDF
// rendering — no server-side re-computation, so the two exports can never
// show different numbers for the same year.
const yearlyPdfRowSchema = z.object({
  date: z.string(), day: z.string(), project: z.string(), task: z.string(),
  start: z.string(), end: z.string(), hours: z.number(), status: z.string(),
});
const yearlyPdfMonthSchema = z.object({
  displayId: z.string(),
  monthLabel: z.string(),
  rows: z.array(yearlyPdfRowSchema).max(31),
  totalHours: z.number(),
  expectedHours: z.number(),
  balance: z.number(),
  workingDays: z.number(),
  leaveDays: z.number(),
});
export const yearlyTimesheetPdfSchema = z.object({
  employeeName: z.string(),
  employeeDisplayId: z.string(),
  jobTitle: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  months: z.array(yearlyPdfMonthSchema).min(1).max(12),
});

export type MonthlyTimesheetEntryInput = z.infer<typeof monthlyEntrySchema>;
export type YearlyTimesheetPdfInput = z.infer<typeof yearlyTimesheetPdfSchema>;
export type UpsertMonthlyTimesheetInput = z.infer<typeof upsertMonthlyTimesheetSchema>;
export type UpdateMonthlyTimesheetInput = z.infer<typeof updateMonthlyTimesheetSchema>;
export type PatchEntriesInput = z.infer<typeof patchEntriesSchema>;
export type PatchMonthlyStatusInput = z.infer<typeof patchMonthlyStatusSchema>;
export type ListMonthlyTimesheetsQuery = z.infer<typeof listMonthlyTimesheetsQuerySchema>;
