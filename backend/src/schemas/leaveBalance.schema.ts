import { z } from 'zod';

export const createLeaveTypeSchema = z.object({
  name:         z.string().min(1).max(100),
  code:         z.string().min(1).max(50).regex(/^[a-z_]+$/, 'code must be lowercase letters and underscores only'),
  description:  z.string().max(500).optional().nullable().transform(v => v || null),
  accrualType:  z.enum(['fixed', 'accrual']).default('fixed'),
  defaultDays:  z.number().min(0).max(365),
  accrualRate:  z.number().min(0).max(31).optional().nullable().transform(v => v ?? null),
  maxCarryover: z.number().min(0).max(365).default(0),
  color:        z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color').default('#6366f1'),
  isActive:     z.boolean().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export const setEntitlementSchema = z.object({
  leaveTypeId:  z.string().uuid(),
  year:         z.coerce.number().int().min(2020).max(2100),
  grantedDays:  z.number().min(0).max(365),
  carriedOver:  z.number().min(0).max(365).default(0),
  notes:        z.string().max(500).optional().nullable().transform(v => v || null),
});

export const listBalancesQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export type CreateLeaveTypeInput  = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput  = z.infer<typeof updateLeaveTypeSchema>;
export type SetEntitlementInput   = z.infer<typeof setEntitlementSchema>;
export type ListBalancesQuery     = z.infer<typeof listBalancesQuerySchema>;
