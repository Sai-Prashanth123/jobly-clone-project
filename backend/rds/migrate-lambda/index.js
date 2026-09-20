// Loads the ported schema into RDS from inside the VPC.
//
// Credentials come from the RDS-managed master secret via the Secrets
// Manager VPC endpoint - there is no NAT here, so the regional public
// endpoint would simply time out.
//
// Modes:
//   { probe: true }          - just prove connectivity
//   { dryRun: true }         - run every statement, collect ALL failures, ROLLBACK
//   { select: 'select ...' } - read-only inspection
//   { createAppUser: true }  - create/refresh the least-privilege app role
//   {}                       - run for real, COMMIT only if everything succeeds
//
// dryRun exists because the repo's migration files turned out not to match
// the live Supabase schema (e.g. 004 indexes timesheets.deleted_at, a column
// that does not exist even in production - that migration was never applied).
// Failing one statement at a time would mean a round trip per mismatch.
const fs = require('fs');
const { Client } = require('pg');
const {
  SecretsManagerClient, GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

// Split on semicolons that are genuinely statement terminators - i.e. not
// inside a string literal, a dollar-quoted function body, or a comment.
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inSingle = false, inLine = false, inBlock = false, dollarTag = null;

  while (i < sql.length) {
    const c = sql[i], next = sql[i + 1];

    if (inLine) {
      buf += c;
      if (c === '\n') inLine = false;
      i++; continue;
    }
    if (inBlock) {
      buf += c;
      if (c === '*' && next === '/') { buf += next; i += 2; inBlock = false; continue; }
      i++; continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += c; i++; continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'") inSingle = sql[i + 1] === "'" ? (buf += sql[++i], true) : false;
      i++; continue;
    }

    if (c === '-' && next === '-') { inLine = true; buf += c; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; buf += c + next; i += 2; continue; }
    if (c === "'") { inSingle = true; buf += c; i++; continue; }

    const dq = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
    if (dq) { dollarTag = dq[0]; buf += dollarTag; i += dollarTag.length; continue; }

    if (c === ';') { out.push(buf.trim()); buf = ''; i++; continue; }
    buf += c; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  // Keep a statement if it contains real SQL once comments are discounted.
  // Testing the RAW text for a leading "--" would drop genuine statements,
  // because each buffer starts with the banner comment that precedes it
  // (e.g. "-- portal_users" then CREATE TABLE portal_users ...).
  return out.filter(s => {
    const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').trim();
    return code.length > 0;
  });
}

exports.handler = async (event = {}) => {
  const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });

  // proxyProbe connects the way the real backend will - through RDS Proxy as
  // app_user - so it exercises the proxy, the security groups, the SCRAM
  // handshake and the grants in one shot. Everything else talks straight to
  // the instance as the master user, because DDL must not depend on the proxy.
  const useProxy = Boolean(event.proxyProbe);
  const secretArn = useProxy ? process.env.APP_USER_SECRET_ARN : process.env.DB_SECRET_ARN;
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const { username, password } = JSON.parse(secret.SecretString);

  const client = new Client({
    host: useProxy ? event.host : process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: username,
    password,
    // RDS presents an AWS-issued cert; skip chain validation rather than
    // bundling the RDS CA into the zip for this one-shot migration.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  try {
    if (event.probe || event.proxyProbe) {
      const r = await client.query(
        'select current_user as who, current_database() as db, version() as v'
      );
      if (!event.proxyProbe) return { ok: true, probe: r.rows[0] };

      // Prove the grants actually work rather than merely existing: a SELECT
      // against a real table, and a DDL attempt that MUST be refused.
      const readable = await client.query(
        'select count(*)::int as n from information_schema.tables ' +
        "where table_schema='public' and table_type='BASE TABLE'"
      );
      const sample = await client.query('select count(*)::int as n from public.portal_users');
      let ddlRefused = false;
      try {
        await client.query('create table public.__perm_check (x int)');
        await client.query('drop table public.__perm_check');
      } catch (e) {
        ddlRefused = /permission denied/i.test(e.message);
      }
      return {
        ok: true,
        via: 'rds-proxy',
        connectedAs: r.rows[0].who,
        database: r.rows[0].db,
        tablesVisible: readable.rows[0].n,
        portalUsersReadable: sample.rows[0].n,
        ddlCorrectlyRefused: ddlRefused,
      };
    }

    // Read-only escape hatch for verifying what actually landed. RDS has no
    // inbound route from outside the VPC, so this Lambda is the only way to
    // inspect it. SELECT-only, so it cannot be used to mutate the database.
    if (event.select) {
      if (!/^\s*select\b/i.test(event.select)) {
        return { ok: false, error: 'select-only' };
      }
      const r = await client.query(event.select);
      return { ok: true, rows: r.rows };
    }

    // Run arbitrary statements in one transaction.
    //
    // This is an administrative escape hatch, and it is the reason this whole
    // function should be deleted once the migration is signed off: RDS has no
    // inbound route from outside the VPC, so this Lambda is the only way to
    // reach the database at all - which also makes it the only thing that
    // could reach the database if its invoke permission were ever abused.
    if (event.exec) {
      const stmts = Array.isArray(event.exec) ? event.exec : [event.exec];
      const done = [];
      await client.query('BEGIN');
      try {
        for (const s of stmts) {
          const r = await client.query(s);
          done.push({ rows: r.rowCount, command: r.command });
        }
      } catch (err) {
        await client.query('ROLLBACK');
        return { ok: false, error: err.message, completed: done.length, of: stmts.length };
      }
      await client.query('COMMIT');
      return { ok: true, results: done };
    }

    // Load the production data dump.
    //
    // session_replication_role = replica is what makes this possible at all.
    // pg_dump warned that employees carries circular foreign keys, so no
    // insert order satisfies every constraint; 'replica' suspends FK checks
    // for the session. It also suspends the 29 user triggers, which matters
    // just as much: update_updated_at would otherwise stamp every row with
    // the load time and destroy the real audit timestamps.
    if (event.loadData) {
      // pg_dump 18 emits \restrict / \unrestrict around the dump. Those are
      // psql meta-commands, not SQL, so node-postgres rejects them. Stripped
      // here rather than in the file so data.sql stays a pristine pg_dump.
      const sql = fs
        .readFileSync(__dirname + '/data.sql', 'utf8')
        .replace(/^\\(un)?restrict .*$/gm, '');
      const statements = splitStatements(sql);

      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");

      // Re-runnable: clear whatever is there first. Built from the catalog so
      // a new table can never be silently left behind holding stale rows.
      const tbl = await client.query(
        `SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') AS list
           FROM pg_tables WHERE schemaname = 'public'`
      );
      if (tbl.rows[0].list) {
        await client.query(`TRUNCATE TABLE ${tbl.rows[0].list} CASCADE`);
      }

      // No per-statement savepoints here, unlike the schema load: a data load
      // is all-or-nothing, and 5.5k savepoints would triple the round trips.
      let n = 0;
      try {
        for (const stmt of statements) {
          await client.query(stmt);
          n++;
        }
      } catch (err) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          failedAt: n + 1,
          of: statements.length,
          error: err.message,
          statement: statements[n] ? statements[n].slice(0, 200).replace(/\s+/g, ' ') : null,
        };
      }

      if (event.dryRun) {
        await client.query('ROLLBACK');
        return { ok: true, mode: 'dryRun', statements: statements.length };
      }
      await client.query('COMMIT');

      const counts = await client.query(
        `SELECT c.relname AS tbl, c.reltuples::bigint AS est
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'`
      );
      return { ok: true, statements: statements.length, tables: counts.rowCount };
    }

    // Run several SELECTs in one invocation and report each outcome. Used to
    // validate generated SQL against the real schema without a round trip per
    // statement. SELECT-only, same as `select`.
    if (event.selects) {
      const out = [];
      for (const s of event.selects) {
        const text = typeof s === 'string' ? s : s.text;
        const values = typeof s === 'string' ? [] : (s.values || []);
        if (!/^\s*select\b/i.test(text)) {
          out.push({ ok: false, error: 'select-only', label: s.label });
          continue;
        }
        try {
          const r = await client.query(text, values);
          out.push({ ok: true, label: s.label, rows: r.rowCount, cols: r.fields.map(f => f.name) });
        } catch (err) {
          out.push({ ok: false, label: s.label, error: err.message });
        }
      }
      return { ok: out.every(o => o.ok), results: out };
    }

    // The application must not connect as the RDS master user. This creates
    // (or re-syncs) app_user with the password CloudFormation generated, and
    // grants it DML on the schema but no DDL, no superuser, no role creation.
    if (event.createAppUser) {
      const s = await sm.send(new GetSecretValueCommand({ SecretId: process.env.APP_USER_SECRET_ARN }));
      const app = JSON.parse(s.SecretString);

      // DDL cannot take bind parameters, so the identifier and password have
      // to be inlined. Let Postgres do the quoting rather than hand-rolling
      // an escape - quote_ident/quote_literal are the authoritative versions.
      const q = await client.query(
        'select quote_ident($1) as ident, quote_literal($2) as pw, quote_ident(current_database()) as db',
        [app.username, app.password]
      );
      const { ident, pw, db } = q.rows[0];

      const exists = await client.query('select 1 from pg_roles where rolname = $1', [app.username]);
      const steps = [];
      const run = async label => { steps.push(label); };

      await client.query('BEGIN');
      if (exists.rowCount) {
        await client.query(`ALTER ROLE ${ident} WITH LOGIN PASSWORD ${pw}`);
        await run('password reset on existing role');
      } else {
        await client.query(`CREATE ROLE ${ident} WITH LOGIN PASSWORD ${pw}`);
        await run('role created');
      }

      for (const stmt of [
        `GRANT CONNECT ON DATABASE ${db} TO ${ident}`,
        `GRANT USAGE ON SCHEMA public TO ${ident}`,
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ident}`,
        `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ident}`,
        `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${ident}`,
        // The GRANTs above only cover objects that exist right now. Without
        // these, every table a future migration adds would be invisible to
        // the app until someone remembered to re-grant.
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ident}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ident}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${ident}`,
      ]) {
        await client.query(stmt);
        await run(stmt.replace(new RegExp(` TO ${ident}$`), '').slice(0, 70));
      }
      await client.query('COMMIT');

      const check = await client.query(
        `select count(*)::int as tables from information_schema.table_privileges
         where grantee = $1 and privilege_type = 'SELECT'`, [app.username]
      );
      return { ok: true, user: app.username, steps, tablesGranted: check.rows[0].tables };
    }

    let sql = fs.readFileSync(__dirname + '/schema.sql', 'utf8');
    // Strip the file's own transaction wrapper - this function manages it,
    // so that dryRun can always roll back.
    sql = sql.replace(/^\s*BEGIN;\s*$/im, '').replace(/^\s*COMMIT;\s*$/im, '');

    const statements = splitStatements(sql);
    const failures = [];

    await client.query('BEGIN');
    let n = 0;
    for (const stmt of statements) {
      n++;
      // Postgres aborts the whole transaction on any error. A plain
      // ROLLBACK would also throw away every statement that already
      // succeeded, so later statements would fail spuriously (an index on
      // a table that "no longer exists"). A savepoint per statement lets
      // us undo just the failing one and keep the rest of the schema.
      await client.query(`SAVEPOINT s${n}`);
      try {
        await client.query(stmt);
        await client.query(`RELEASE SAVEPOINT s${n}`);
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT s${n}`);
        failures.push({ error: err.message, statement: stmt.slice(0, 160).replace(/\s+/g, ' ') });
        if (!event.dryRun) break;
      }
    }

    if (event.dryRun || failures.length) {
      await client.query('ROLLBACK');
      return {
        ok: failures.length === 0,
        mode: event.dryRun ? 'dryRun' : 'aborted',
        statements: statements.length,
        failureCount: failures.length,
        failures: failures.slice(0, 25),
      };
    }

    await client.query('COMMIT');
    const t = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public'"
    );
    return { ok: true, statements: statements.length, tablesCreated: t.rows[0].n };
  } finally {
    await client.end();
  }
};
