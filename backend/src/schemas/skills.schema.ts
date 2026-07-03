import { z } from 'zod';

const PROFICIENCIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
const CURRENT_YEAR = new Date().getUTCFullYear();

export const createSkillSchema = z.object({
  skillName:     z.string().min(1).max(100),
  proficiency:   z.enum(PROFICIENCIES).optional(),
  lastUsedYear:  z.number().int().min(1950).max(CURRENT_YEAR).optional(),
  isPrimary:     z.boolean().optional(),
});

export const updateSkillSchema = z.object({
  proficiency:   z.enum(PROFICIENCIES).optional(),
  lastUsedYear:  z.number().int().min(1950).max(CURRENT_YEAR).optional(),
  isPrimary:     z.boolean().optional(),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
