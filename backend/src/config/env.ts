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
  // Email transport. Preferred: a transactional SMTP provider (Brevo/SendGrid)
  // — no Gmail App Password, better deliverability to Gmail/Outlook.
  SMTP_HOST: z.string().optional(),       // e.g. smtp-relay.brevo.com
  SMTP_PORT: z.string().optional(),       // e.g. 587
  SMTP_USER: z.string().optional(),       // provider SMTP login
  SMTP_PASS: z.string().optional(),       // provider SMTP key
  MAIL_FROM: z.string().optional(),       // verified sender, e.g. "Jobly HR <you@gmail.com>"
  // Legacy Gmail fallback (used only if SMTP_* are unset).
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

const hasSmtp = !!(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS);
const hasGmail = !!(parsed.data.GMAIL_USER && parsed.data.GMAIL_APP_PASSWORD);
if (!hasSmtp && !hasGmail) {
  console.warn('⚠️  No email transport configured — set SMTP_HOST/SMTP_USER/SMTP_PASS (e.g. Brevo) or GMAIL_USER/GMAIL_APP_PASSWORD. Welcome emails will not be delivered.');
}

export const env = parsed.data;
