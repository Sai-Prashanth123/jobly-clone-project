import { z } from 'zod';

// Staff logins only — 'employee' is deliberately excluded. An employee account
// is created through the employee flow, which also builds the employee record
// (timesheets, documents, onboarding) that this path does not.
export const STAFF_ROLES = ['admin', 'hr', 'operations', 'finance', 'legal'] as const;

export const createStaffUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.enum(STAFF_ROLES),
});

export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
