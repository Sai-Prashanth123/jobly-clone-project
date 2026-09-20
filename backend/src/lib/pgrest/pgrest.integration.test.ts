// End-to-end tests against a real PostgreSQL instance carrying the production
// schema. The unit tests prove the SQL is shaped correctly; these prove it
// actually runs, with real foreign keys, enums and NOT NULL constraints in the
// way, and that results come back in the exact shape the services expect.
//
// Skipped unless PGREST_TEST_DSN points at a throwaway database. Bring one up:
//
//   docker run -d --name jobly-pgrest-test -e POSTGRES_PASSWORD=testpw \
//     -e POSTGRES_DB=appdb -p 55432:5432 postgres:18-alpine
//   docker cp backend/rds/schema.sql jobly-pgrest-test:/tmp/schema.sql
//   docker exec jobly-pgrest-test psql -U postgres -d appdb -f /tmp/schema.sql
//   PGREST_TEST_DSN=postgres://postgres:testpw@127.0.0.1:55432/appdb npx vitest run
//
// The schema file is generated from production, so this database is column-for
// -column identical to the live one (same md5 over information_schema).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { createPgrest, type PgrestClient } from './builder';
import { resetSchemaCache } from './schema';

const DSN = process.env.PGREST_TEST_DSN;
const maybe = DSN ? describe : describe.skip;

maybe('pgrest against a real database', () => {
  let pool: Pool;
  let db: PgrestClient;

  // Fixed ids keep the assertions readable and make cleanup trivial.
  const userId = '11111111-1111-4111-8111-111111111111';
  const user2Id = '11111111-1111-4111-8111-111111111112';
  const clientId = '22222222-2222-4222-8222-222222222222';
  const empId = '33333333-3333-4333-8333-333333333333';
  const asnId = '44444444-4444-4444-8444-444444444444';

  beforeAll(async () => {
    resetSchemaCache();
    pool = new Pool({ connectionString: DSN });
    db = createPgrest(pool);

    // Clean slate, children first so the FKs stay satisfied.
    await pool.query('DELETE FROM timesheet_entries');
    await pool.query('DELETE FROM timesheets');
    await pool.query('DELETE FROM assignments');
    await pool.query('DELETE FROM employees');
    await pool.query('DELETE FROM clients');
    await pool.query('DELETE FROM portal_users');

    await pool.query(
      `INSERT INTO portal_users (id, email, name, role) VALUES ($1,$2,$3,'hr'), ($4,$5,$6,'admin')`,
      [userId, 'hr@example.com', 'Hiring Person', user2Id, 'admin@example.com', 'Admin Person'],
    );
    await pool.query(
      `INSERT INTO clients (id, company_name, contact_name, contact_email, contract_start_date)
       VALUES ($1,'Acme Corp','Contact One','c1@example.com','2026-01-01')`,
      [clientId],
    );
    await pool.query(
      `INSERT INTO employees (id, first_name, last_name, email, department, job_title, start_date, status)
       VALUES ($1,'Ada','Lovelace','ada@example.com','Engineering','Engineer','2026-01-05','active')`,
      [empId],
    );
    await pool.query(
      `INSERT INTO assignments (id, employee_id, client_id, project_name, role, start_date)
       VALUES ($1,$2,$3,'Apollo','Engineer','2026-01-05')`,
      [asnId, empId, clientId],
    );
  });

  afterAll(async () => {
    await pool?.end();
    resetSchemaCache();
  });

  it('introspects the real foreign-key graph', async () => {
    const { data, error } = await db.from('employees').select('id, first_name').eq('id', empId).single();
    expect(error).toBeNull();
    expect(data.first_name).toBe('Ada');
  });

  it('returns a to-one embed as a nested object keyed by table name', async () => {
    const { data, error } = await db
      .from('assignments')
      .select('id, employees!employee_id(first_name, last_name), clients(company_name)')
      .eq('id', asnId)
      .single();
    expect(error).toBeNull();
    expect(data.employees).toEqual({ first_name: 'Ada', last_name: 'Lovelace' });
    expect(data.clients).toEqual({ company_name: 'Acme Corp' });
  });

  it('returns a to-many embed as an array, empty rather than null', async () => {
    const { data: ts } = await db
      .from('timesheets')
      .insert({
        employee_id: empId, assignment_id: asnId, client_id: clientId,
        week_start_date: '2026-02-02', week_end_date: '2026-02-08', status: 'draft',
      })
      .select('id')
      .single();

    const before = await db.from('timesheets').select('id, timesheet_entries(*)').eq('id', ts.id).single();
    expect(before.data.timesheet_entries).toEqual([]);

    await db.from('timesheet_entries').insert([
      { timesheet_id: ts.id, entry_date: '2026-02-02', day_of_week: 'Monday', hours: 8 },
      { timesheet_id: ts.id, entry_date: '2026-02-03', day_of_week: 'Tuesday', hours: 7 },
    ]);

    const after = await db
      .from('timesheets')
      .select('id, timesheet_entries(entry_date, hours)')
      .eq('id', ts.id)
      .single();
    expect(after.data.timesheet_entries).toHaveLength(2);
    // Numeric columns come back as strings from pg; the services already
    // handle that, but assert it so the behaviour is recorded.
    expect(after.data.timesheet_entries.map((e: { hours: unknown }) => Number(e.hours)).sort())
      .toEqual([7, 8]);
  });

  it('uses the alias as the key for an aliased embed', async () => {
    await db.from('assignments').update({ created_by: userId, updated_by: user2Id }).eq('id', asnId);
    const { data, error } = await db
      .from('assignments')
      .select('id, created_by_user:portal_users!created_by(name), updated_by_user:portal_users!updated_by(name)')
      .eq('id', asnId)
      .single();
    expect(error).toBeNull();
    expect(data.created_by_user).toEqual({ name: 'Hiring Person' });
    expect(data.updated_by_user).toEqual({ name: 'Admin Person' });
  });

  it('a to-one embed with no match is null, not an error', async () => {
    await db.from('assignments').update({ reporting_manager_id: null }).eq('id', asnId);
    const { data } = await db
      .from('assignments')
      .select('id, reporting_manager:employees!reporting_manager_id(first_name)')
      .eq('id', asnId)
      .single();
    expect(data.reporting_manager).toBeNull();
  });

  it('returns an exact count independent of range()', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      first_name: `E${i}`, last_name: 'Test', email: `e${i}@example.com`,
      department: 'Ops', job_title: 'Analyst', start_date: '2026-01-01', status: 'active',
    }));
    await db.from('employees').insert(rows);

    const { data, count, error } = await db
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('department', 'Ops')
      .order('email', { ascending: true })
      .range(0, 2);

    expect(error).toBeNull();
    expect(count).toBe(7);        // full filtered set
    expect(data).toHaveLength(3); // inclusive range 0..2
  });

  it('head:true returns the count without fetching rows', async () => {
    const { data, count } = await db
      .from('employees').select('*', { count: 'exact', head: true }).eq('department', 'Ops');
    expect(count).toBe(7);
    expect(data).toEqual([]);
  });

  it('or() with ilike searches across columns', async () => {
    const { data, error } = await db
      .from('employees')
      .select('first_name, last_name')
      .or('first_name.ilike.%Ada%,last_name.ilike.%Ada%');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].first_name).toBe('Ada');
  });

  it('or() mixing is.null and a comparison', async () => {
    const { data, error } = await db
      .from('employees').select('id').or('visa_expiry.is.null,visa_expiry.gt.2030-01-01');
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  it('in() and not-in() over a list', async () => {
    const inRes = await db.from('employees').select('first_name').in('first_name', ['Ada', 'E1']);
    expect(inRes.data.map((r: { first_name: string }) => r.first_name).sort()).toEqual(['Ada', 'E1']);

    const notRes = await db.from('employees').select('id').eq('department', 'Ops').not('first_name', 'in', '(E0,E1)');
    expect(notRes.data).toHaveLength(5);
  });

  it('is(null) and not-is(null) hit the right rows', async () => {
    const nulls = await db.from('employees').select('id').is('visa_expiry', null);
    expect(nulls.data.length).toBeGreaterThan(0);
    const notNulls = await db.from('employees').select('id').not('visa_expiry', 'is', null);
    expect(notNulls.data).toHaveLength(0);
  });

  it('update returns the patched row when .select() is chained', async () => {
    const { data, error } = await db
      .from('employees').update({ job_title: 'Principal Engineer' }).eq('id', empId).select('*').single();
    expect(error).toBeNull();
    expect(data.job_title).toBe('Principal Engineer');
  });

  it('update with an embedded select re-reads the row', async () => {
    const { data, error } = await db
      .from('assignments')
      .update({ status: 'active' })
      .eq('id', asnId)
      .select('id, employees!employee_id(first_name)')
      .single();
    expect(error).toBeNull();
    expect(data.employees).toEqual({ first_name: 'Ada' });
  });

  it('upsert inserts then updates on the conflict target', async () => {
    const row = { key: 'pgrest_probe', value: 'one' };
    await db.from('system_settings').upsert(row, { onConflict: 'key' });
    const first = await db.from('system_settings').select('value').eq('key', 'pgrest_probe').single();
    expect(first.data.value).toBe('one');

    await db.from('system_settings').upsert({ key: 'pgrest_probe', value: 'two' }, { onConflict: 'key' });
    const second = await db.from('system_settings').select('value').eq('key', 'pgrest_probe').single();
    expect(second.data.value).toBe('two');

    const all = await db.from('system_settings').select('key', { count: 'exact', head: true }).eq('key', 'pgrest_probe');
    expect(all.count).toBe(1);
  });

  it('surfaces 23505 on a unique violation instead of throwing', async () => {
    const dup = {
      first_name: 'Dup', last_name: 'Test', email: 'ada@example.com',
      department: 'Ops', job_title: 'Analyst', start_date: '2026-01-01',
    };
    const { data, error } = await db.from('employees').insert(dup).select('*');
    expect(data).toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('reports a foreign-key violation rather than crashing', async () => {
    const { error } = await db.from('timesheet_entries')
      .insert({ timesheet_id: '99999999-9999-4999-8999-999999999999', entry_date: '2026-02-02', day_of_week: 'Monday' })
      .select('*');
    expect(error?.code).toBe('23503');
  });

  it('single() on zero rows gives PGRST116, maybeSingle() gives null', async () => {
    const one = await db.from('employees').select('*').eq('email', 'nobody@example.com').single();
    expect(one.data).toBeNull();
    expect(one.error?.code).toBe('PGRST116');

    const maybe2 = await db.from('employees').select('*').eq('email', 'nobody@example.com').maybeSingle();
    expect(maybe2.data).toBeNull();
    expect(maybe2.error).toBeNull();
  });

  it('delete removes rows and reports them when selected', async () => {
    const { data } = await db.from('employees').delete().eq('first_name', 'E0').select('id');
    expect(data).toHaveLength(1);
    const gone = await db.from('employees').select('id').eq('first_name', 'E0');
    expect(gone.data).toHaveLength(0);
  });

  it('a write without .select() returns no rows but still applies', async () => {
    const res = await db.from('employees').update({ job_title: 'Staff Engineer' }).eq('id', empId);
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
    const check = await db.from('employees').select('job_title').eq('id', empId).single();
    expect(check.data.job_title).toBe('Staff Engineer');
  });

  it('order(ascending:false) sorts descending', async () => {
    const { data } = await db.from('employees').select('email').eq('department', 'Ops')
      .order('email', { ascending: false }).limit(2);
    expect(data[0].email > data[1].email).toBe(true);
  });

  it('refuses an ambiguous embed instead of returning the wrong row', async () => {
    // case_notes has two FKs to portal_users; without a hint this must fail.
    const { error } = await db.from('case_notes').select('*, portal_users(name)');
    expect(error?.message).toMatch(/ambiguous/);
  });
});
