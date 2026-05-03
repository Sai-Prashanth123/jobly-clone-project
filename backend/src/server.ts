import { app } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { verifyMailer } from './lib/mailer';

async function startServer(): Promise<void> {
  // Test Supabase connection
  try {
    const { error } = await supabaseAdmin.from('portal_users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️  Supabase connection warning:', error.message);
    } else {
      console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err);
    process.exit(1);
  }

  // Verify mailer at boot so SMTP misconfig is visible in logs immediately
  // (otherwise auth errors only surface — and get swallowed — at send time).
  await verifyMailer();

  const port = parseInt(env.PORT, 10);
  app.listen(port, () => {
    console.log(`🚀 Jobly Backend running on http://localhost:${port}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   API base: http://localhost:${port}/api/v1`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
