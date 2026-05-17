import { app } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { verifyMailer } from './lib/mailer';

// Process-level safety nets. Without these, a stray unhandled Promise
// rejection (e.g. a fire-and-forget notification) leaves the process in an
// undefined state — Node 17+ exits on unhandledRejection by default, which
// is fine, but we want a structured log first so ops can debug.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Re-throw to let the orchestrator restart us in a known-good state.
  process.exit(1);
});

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
  const httpServer = app.listen(port, () => {
    console.log(`🚀 Jobly Backend running on http://localhost:${port}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   API base: http://localhost:${port}/api/v1`);
  });

  // Graceful shutdown on container stop / Ctrl+C so in-flight requests
  // finish and the DB connection pool drains cleanly.
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — draining connections…`);
    httpServer.close(err => {
      if (err) {
        console.error('Error during server close', err);
        process.exit(1);
      }
      console.log('HTTP server closed cleanly');
      process.exit(0);
    });
    // Force-exit if cleanup hangs longer than 10s
    setTimeout(() => {
      console.warn('Shutdown timeout — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
