import { z } from 'zod';

export const upsertPermDetailsSchema = z.object({
  jobTitle: z.string().optional().nullable(),
  fullTimePosition: z.boolean().optional().nullable(),
  workHoursPerWeek: z.number().optional().nullable(),
  wageRate: z.number().optional().nullable(),
  socCode: z.string().optional().nullable(),
  payFrequency: z.string().optional().nullable(),
  classification: z.string().optional().nullable(),
  permanentPosition: z.boolean().optional().nullable(),
  experienceRequired: z.boolean().optional().nullable(),
  monthsOfExperience: z.number().int().optional().nullable(),
  workAddress: z.string().optional().nullable(),
  minimumEducation: z.string().optional().nullable(),
  majorFieldOfStudy: z.string().optional().nullable(),
});

export type UpsertPermDetailsInput = z.infer<typeof upsertPermDetailsSchema>;
