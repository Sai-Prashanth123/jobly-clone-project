import { z } from 'zod';

const LEAVE_TYPES = [
  'medical_leave', 'sick', 'vacation', 'unpaid_leave', 'bereavement', 'jury_duty', 'other',
] as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createLeaveRequestSchema = z
  .object({
    // employeeId is optional — defaults to the caller's own employee record on
    // the server. Admin/HR may file on behalf of an employee by passing it.
    employeeId: z.string().uuid().optional(),
    leaveType: z.enum(LEAVE_TYPES),
    startDate: dateStr,
    endDate: dateStr,
    reason: z.string().max(2000).optional().nullable().transform(v => v || null),
  })
  .refine(d => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  });

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().max(2000).optional().nullable().transform(v => v || null),
});

export const listLeaveRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;
export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
