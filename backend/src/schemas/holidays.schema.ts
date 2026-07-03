import { z } from 'zod';

export const createHolidaySchema = z.object({
  name:        z.string().min(1).max(200),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  isRecurring: z.boolean().optional(),
  countryCode: z.string().max(8).optional(),
});

export const updateHolidaySchema = createHolidaySchema.partial();

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
