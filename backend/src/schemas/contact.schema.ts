import { z } from 'zod';

// Public website "Contact Us" form. `website` is a honeypot — real users leave
// it blank; bots that auto-fill every field get silently dropped (controller).
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('A valid email is required').max(200),
  phone: z.string().trim().max(50).optional().default(''),
  subject: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().min(1, 'Message is required').max(5000),
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
