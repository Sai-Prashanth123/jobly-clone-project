// Postgres connection pool for the RDS backend.
//
// Only created when DB_DRIVER=postgres. The app currently runs on Render
// against Supabase, and RDS lives in private subnets with no public route, so
// a pool opened there would just pile up connection timeouts. Keeping this
// lazy means the Supabase path is completely unaffected until the switch is
// deliberately thrown.
import { Pool } from 'pg';
import { env } from './env';
import { pgrestTypes } from '../lib/pgrest/types-pg';

let pool: Pool | null = null;

export function isPostgresDriver(): boolean {
  return env.DB_DRIVER === 'postgres';
}

export function getPool(): Pool {
  if (pool) return pool;

  const missing = (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const).filter(k => !env[k]);
  if (missing.length) {
    throw new Error(
      `DB_DRIVER=postgres requires ${missing.join(', ')}. ` +
        'On AWS these come from the stack; locally put them in backend/.env.',
    );
  }

  pool = new Pool({
    // Hand date/timestamp columns back as the strings PostgREST produced.
    // Without this node-postgres returns Date objects, which the ~500 call
    // sites written against supabase-js do not expect - see types-pg.ts.
    types: pgrestTypes,
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    // Connections go through RDS Proxy, which is configured RequireTLS, so
    // the wire is encrypted either way. Chain validation is off because the
    // proxy presents an AWS-issued cert that isn't in Node's trust store;
    // bundling the RDS CA bundle is the follow-up hardening step.
    ssl: env.DB_SSL === 'disable' ? undefined : { rejectUnauthorized: false },
    // The proxy does the real pooling, so each process needs very few
    // connections of its own. A Lambda container serves one request at a
    // time; a long-running server wants a handful.
    max: Number(env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // A pool error (a connection dropped while idle) is emitted on the pool, not
  // on a query. Without a listener Node treats it as an unhandled 'error'
  // event and kills the process.
  pool.on('error', err => {
    console.error('[db] idle client error:', err.message);
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
