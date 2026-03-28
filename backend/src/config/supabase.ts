import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service role client — bypasses RLS, use only on backend
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client — for Auth operations only
export const supabaseAnon = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);
