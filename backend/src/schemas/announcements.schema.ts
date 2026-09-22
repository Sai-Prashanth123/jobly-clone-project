import { z } from 'zod';

const ANNOUNCEMENT_TYPES = ['info', 'urgent', 'event', 'policy'] as const;
const ALL_ROLES = ['admin', 'hr', 'operations', 'finance', 'employee', 'legal'] as const;

export const createAnnouncementSchema = z.object({
  title:       z.string().min(1).max(200),
  body:        z.string().min(1).max(10000),
  type:        z.enum(ANNOUNCEMENT_TYPES).default('info'),
  isPinned:    z.boolean().default(false),
  targetRoles: z.array(z.enum(ALL_ROLES)).default([]),
  expiresAt:   z
    .string()
    .optional()
    .nullable()
    .transform(v => {
      if (!v) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00.000Z`;
      return v;
    })
    // Deliberately NOT restricted to future dates. Staff asked to be able to
    // set a past expiry, e.g. to record an announcement that has already run
    // its course. Such an announcement is immediately expired and will not
    // appear in the list (which filters on expires_at > now), so the form
    // warns about that at the point of entry rather than the API refusing it.
    .pipe(z.string().datetime({ offset: true }).nullable()),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const listAnnouncementsQuerySchema = z.object({
  type:  z.enum(ANNOUNCEMENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page:  z.coerce.number().int().min(1).default(1),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListAnnouncementsQuery  = z.infer<typeof listAnnouncementsQuerySchema>;
