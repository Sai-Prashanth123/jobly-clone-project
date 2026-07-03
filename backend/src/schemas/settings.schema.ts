import { z } from 'zod';

// `system_settings` is a generic key/value store (see settings.service.ts —
// updateSettings() upserts one row per key). The portal's SystemSettings page
// only ever sends these known keys, but the table isn't restricted to them,
// so we validate the known ones by shape and otherwise accept any string
// value for forward-compat with new settings keys.
export const updateSettingsSchema = z
  .object({
    company_name:            z.string().max(200).optional(),
    company_logo_url:        z.string().max(2000).optional(),
    timezone:                z.string().max(100).optional(),
    fiscal_year_start_month: z.string().regex(/^([1-9]|1[0-2])$/).optional(),
    default_currency:        z.string().length(3).optional(),
    date_format:             z.string().max(20).optional(),
  })
  .catchall(z.string());

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
