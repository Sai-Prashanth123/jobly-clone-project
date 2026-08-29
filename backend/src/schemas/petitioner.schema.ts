import { z } from 'zod';

export const createPetitionerSchema = z.object({
  name: z.string().min(1),
  addressStreet: z.string().optional().nullable().transform(v => v || null),
  addressCity: z.string().optional().nullable().transform(v => v || null),
  addressState: z.string().optional().nullable().transform(v => v || null),
  addressZip: z.string().optional().nullable().transform(v => v || null),
  addressCountry: z.string().optional().nullable().transform(v => v || null),
  einFein: z.string().optional().nullable().transform(v => v || null),
});

export const updatePetitionerSchema = createPetitionerSchema.partial();

export type CreatePetitionerInput = z.infer<typeof createPetitionerSchema>;
export type UpdatePetitionerInput = z.infer<typeof updatePetitionerSchema>;
