import { z } from 'zod';

export const emailTestSchema = z.object({
  to: z.string().email(),
});

export type EmailTestInput = z.infer<typeof emailTestSchema>;
