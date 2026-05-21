import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EnvSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  FRONTEND_URL: z.string().default('http://localhost:8080'),
  // Optional — if unset, welcome/invoice emails are disabled with a warning.
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  // Optional fallback recipient for monthly-timesheet reports when no HR
  // portal_users exist. If unset and there are no HR users, the email is skipped.
  HR_FALLBACK_EMAIL: z.string().email().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (!parsed.data.GMAIL_USER || !parsed.data.GMAIL_APP_PASSWORD) {
  console.warn('⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set — welcome emails will not be delivered. Set both as env vars on the host.');
}

export const env = parsed.data;
