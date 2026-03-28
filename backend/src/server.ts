import { app } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';

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
