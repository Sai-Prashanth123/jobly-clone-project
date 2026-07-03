import { z } from 'zod';

const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'night'] as const;

export const createShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    startTime:  z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
    endTime:    z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
    shiftType:  z.enum(SHIFT_TYPES).optional(),
    notes:      z.string().max(2000).optional().nullable(),
  })
  .refine(data => data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export const updateShiftSchema = z
  .object({
    date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    startTime:  z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
    endTime:    z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
    shiftType:  z.enum(SHIFT_TYPES).optional(),
    notes:      z.string().max(2000).optional().nullable(),
  })
  .refine(data => !(data.startTime && data.endTime) || data.startTime < data.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
