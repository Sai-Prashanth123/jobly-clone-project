import { describe, it, expect } from 'vitest';
import { parseSelect } from './select';
import { parseOr, parseFilterTerm, Params, compileFilter } from './filters';
import { compileSelectQuery, compileCountQuery, compileInsert, compileUpdate } from './compile';
import { resolveEmbed, type SchemaInfo } from './schema';
import { QueryBuilder, type Executor } from './builder';

// A cut-down stand-in for the real introspection, covering exactly the tables
// the select strings below reach. Mirrors the live FK layout.
const schema: SchemaInfo = {
  fks: [
    { table: 'leave_requests', column: 'employee_id', refTable: 'employees', refColumn: 'id', constraint: 'lr_emp_fk' },
    { table: 'timesheet_entries', column: 'timesheet_id', refTable: 'timesheets', refColumn: 'id', constraint: 'te_ts_fk' },
    { table: 'timesheets', column: 'employee_id', refTable: 'employees', refColumn: 'id', constraint: 'ts_emp_fk' },
    { table: 'timesheets', column: 'client_id', refTable: 'clients', refColumn: 'id', constraint: 'ts_cli_fk' },
    { table: 'invoices', column: 'client_id', refTable: 'clients', refColumn: 'id', constraint: 'inv_cli_fk' },
    { table: 'case_notes', column: 'case_id', refTable: 'cases', refColumn: 'id', constraint: 'cn_case_fk' },
    { table: 'case_notes', column: 'author_id', refTable: 'portal_users', refColumn: 'id', constraint: 'cn_author_fk' },
    { table: 'case_notes', column: 'tagged_to', refTable: 'portal_users', refColumn: 'id', constraint: 'cn_tagged_fk' },
    { table: 'cases', column: 'employee_id', refTable: 'employees', refColumn: 'id', constraint: 'case_emp_fk' },
    { table: 'assignments', column: 'created_by', refTable: 'portal_users', refColumn: 'id', constraint: 'as_cb_fk' },
  ],
  pks: new Map([
    ['leave_requests', ['id']],
    ['timesheets', ['id']],
    ['cases', ['id']],
    ['case_notes', ['id']],
    ['employees', ['id']],
    ['invoices', ['id']],
    ['clients', ['id']],
  ]),
  // Mirrors the live schema closely enough for the write tests: these are the
  // jsonb columns whose values must be JSON-encoded rather than handed to
  // node-postgres as-is (which would send a Postgres array literal).
  jsonColumns: new Map([
    ['employees', new Set(['identity_documents', 'education'])],
  ]),
};

const sql = (b: { text: string }) => b.text.replace(/\s+/g, ' ').trim();

describe('parseSelect', () => {
  it('treats an absent select as *', () => {
    expect(parseSelect()).toEqual([{ kind: 'star' }]);
    expect(parseSelect('')).toEqual([{ kind: 'star' }]);
  });

  it('parses a plain column list', () => {
    expect(parseSelect('id, display_id, status')).toEqual([
      { kind: 'column', name: 'id', alias: undefined },
      { kind: 'column', name: 'display_id', alias: undefined },
      { kind: 'column', name: 'status', alias: undefined },
    ]);
  });

  // The real string from leaveRequests.service.ts
  it('parses an FK-hinted embed', () => {
    const nodes = parseSelect('*, employees!employee_id(first_name, last_name, display_id)');
    expect(nodes[0]).toEqual({ kind: 'star' });
    expect(nodes[1]).toMatchObject({ kind: 'embed', table: 'employees', hint: 'employee_id' });
  });

  // The real string from assignments.service.ts
  it('parses an aliased embed', () => {
    const [node] = parseSelect('created_by_user:portal_users!created_by(name, role)');
    expect(node).toMatchObject({
      kind: 'embed', table: 'portal_users', alias: 'created_by_user', hint: 'created_by',
    });
  });

  // The real NOTE_SELECT nested inside DETAIL_SELECT in cases.service.ts
  it('parses two-level nesting', () => {
    const [node] = parseSelect(
      'case_notes(*, portal_users!author_id(name), tagged_to_user:portal_users!tagged_to(name))',
    );
    expect(node.kind).toBe('embed');
    if (node.kind !== 'embed') throw new Error('unreachable');
    expect(node.children).toHaveLength(3);
    expect(node.children[1]).toMatchObject({ kind: 'embed', hint: 'author_id' });
    expect(node.children[2]).toMatchObject({ kind: 'embed', alias: 'tagged_to_user', hint: 'tagged_to' });
  });

  it('rejects unbalanced parentheses', () => {
    expect(() => parseSelect('*, employees(first_name')).toThrow(/unbalanced/);
  });
});

describe('embed resolution', () => {
  it('detects a to-one embed from the parent FK', () => {
    expect(resolveEmbed(schema, 'leave_requests', 'employees', 'employee_id')).toEqual({
      kind: 'toOne', parentColumn: 'employee_id', childColumn: 'id',
    });
  });

  it('detects a to-many embed from the child FK', () => {
    expect(resolveEmbed(schema, 'timesheets', 'timesheet_entries')).toEqual({
      kind: 'toMany', parentColumn: 'id', childColumn: 'timesheet_id',
    });
  });

  it('refuses an ambiguous pair rather than guessing', () => {
    // case_notes has TWO FKs to portal_users; picking one silently would
    // attribute notes to the wrong person.
    expect(() => resolveEmbed(schema, 'case_notes', 'portal_users')).toThrow(/ambiguous/);
  });

  it('resolves the ambiguity when hinted', () => {
    expect(resolveEmbed(schema, 'case_notes', 'portal_users', 'author_id')).toEqual({
      kind: 'toOne', parentColumn: 'author_id', childColumn: 'id',
    });
  });

  it('explains an unrelated pair', () => {
    expect(() => resolveEmbed(schema, 'employees', 'assignments')).toThrow(/no foreign key/);
  });
});

describe('select SQL', () => {
  const spec = (nodes: ReturnType<typeof parseSelect>, extra = {}) => ({
    table: 'leave_requests', nodes, filters: [], orders: [], ...extra,
  });

  it('builds a to-one embed as a scalar json subquery', () => {
    const q = compileSelectQuery(
      spec(parseSelect('*, employees!employee_id(first_name)')), schema,
    );
    expect(sql(q)).toContain('SELECT to_jsonb(_t1)');
    // Joined child.id = parent.employee_id, i.e. the FK is on the parent.
    expect(sql(q)).toContain('_t0."id" = _r."employee_id"');
    expect(sql(q)).toContain('AS "employees"');
    // A to-one embed must not be wrapped in jsonb_agg.
    expect(sql(q)).not.toContain('jsonb_agg');
  });

  it('builds a to-many embed as a json array defaulting to []', () => {
    const q = compileSelectQuery(
      { table: 'timesheets', nodes: parseSelect('*, timesheet_entries(*)'), filters: [], orders: [] },
      schema,
    );
    expect(sql(q)).toContain("COALESCE(jsonb_agg(to_jsonb(_t1)), '[]'::jsonb)");
    expect(sql(q)).toContain('_t0."timesheet_id" = _r."id"');
  });

  it('uses the alias as the result key', () => {
    const q = compileSelectQuery(
      { table: 'assignments', nodes: parseSelect('created_by_user:portal_users!created_by(name)'), filters: [], orders: [] },
      schema,
    );
    expect(sql(q)).toContain('AS "created_by_user"');
  });

  it('parameterises every value', () => {
    const q = compileSelectQuery(
      spec(parseSelect('*'), {
        filters: [{ kind: 'op', column: 'status', op: 'eq', value: "'; DROP TABLE x --" }],
      }),
      schema,
    );
    expect(q.text).toContain('_r."status" = $1');
    expect(q.text).not.toContain('DROP TABLE');
    expect(q.values).toEqual(["'; DROP TABLE x --"]);
  });

  it('range() is inclusive at both ends', () => {
    const q = compileSelectQuery(spec(parseSelect('*'), { offset: 20, limit: 10 }), schema);
    expect(sql(q)).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(q.values).toEqual([10, 20]);
  });

  it('count ignores limit/offset so pagination totals are right', () => {
    const q = compileCountQuery(
      spec(parseSelect('*'), {
        limit: 10, offset: 20,
        filters: [{ kind: 'op', column: 'status', op: 'eq', value: 'pending' }],
      }),
      schema,
    );
    expect(sql(q)).toBe('SELECT count(*)::bigint AS count FROM "leave_requests" _r WHERE _r."status" = $1');
  });
});

describe('filter grammar', () => {
  const render = (f: Parameters<typeof compileFilter>[0]) => {
    const p = new Params();
    return { text: compileFilter(f, '_r', p), values: p.values };
  };

  it('is-null cannot be a bind parameter', () => {
    expect(render({ kind: 'is', column: 'deleted_at', value: null }).text)
      .toBe('_r."deleted_at" IS NULL');
  });

  it('in() uses = ANY so it survives long lists', () => {
    const r = render({ kind: 'in', column: 'id', values: ['a', 'b'] });
    expect(r.text).toBe('_r."id" = ANY($1)');
    expect(r.values).toEqual([['a', 'b']]);
  });

  it('in() with an empty list matches nothing', () => {
    expect(render({ kind: 'in', column: 'id', values: [] }).text).toBe('FALSE');
  });

  // Real term from notifications: values contain dots, so only the first two
  // separate column/op/value.
  it('splits only on the first two dots', () => {
    expect(parseFilterTerm('email.eq.someone@example.co.uk')).toEqual({
      kind: 'op', column: 'email', op: 'eq', value: 'someone@example.co.uk',
    });
    expect(parseFilterTerm('expires_at.gt.2026-09-20T10:00:00.123Z')).toMatchObject({
      op: 'gt', value: '2026-09-20T10:00:00.123Z',
    });
  });

  it('handles is.null inside an or()', () => {
    const f = parseOr('expires_at.is.null,expires_at.gt.2026-01-01');
    const r = render(f);
    expect(r.text).toBe('(_r."expires_at" IS NULL OR _r."expires_at" > $1)');
  });

  // Real term from announcements: target_roles.eq.{},target_roles.cs.{admin}
  it('handles array literals and containment', () => {
    const f = parseOr('target_roles.eq.{},target_roles.cs.{admin}');
    const r = render(f);
    expect(r.text).toBe('(_r."target_roles" = $1 OR _r."target_roles" @> $2)');
    expect(r.values).toEqual([[], ['admin']]);
  });

  it('does not split a comma inside an array literal', () => {
    const f = parseOr('target_roles.cs.{admin,hr}');
    expect(render(f).values).toEqual([['admin', 'hr']]);
  });

  it('search terms with commas stay one term', () => {
    const f = parseOr('company_name.ilike.%Acme%,contact_name.ilike.%Acme%');
    expect(render(f).text)
      .toBe('(_r."company_name" ILIKE $1 OR _r."contact_name" ILIKE $2)');
  });
});

describe('writes', () => {
  it('insert lists columns once and parameterises values', () => {
    const q = compileInsert('employees', [{ first_name: 'A', last_name: 'B' }], '*');
    expect(sql(q)).toBe(
      'INSERT INTO "employees" ("first_name", "last_name") VALUES ($1, $2) RETURNING *',
    );
  });

  it('multi-row insert keeps column arity when keys differ', () => {
    const q = compileInsert('employees', [{ a: 1 }, { a: 2, b: 3 }], '"id"');
    expect(sql(q)).toContain('("a", "b") VALUES ($1, DEFAULT), ($2, $3)');
  });

  it('upsert updates every non-key column', () => {
    const q = compileInsert(
      'case_message_reads', [{ message_id: 'm', user_id: 'u', read_at: 't' }], '"id"', 'message_id',
    );
    expect(sql(q)).toContain('ON CONFLICT ("message_id") DO UPDATE SET "user_id" = EXCLUDED."user_id", "read_at" = EXCLUDED."read_at"');
  });

  it('update qualifies the where clause but not the set list', () => {
    const q = compileUpdate(
      'leave_requests', { status: 'approved' },
      [{ kind: 'op', column: 'id', op: 'eq', value: 'x' }], '*',
    );
    expect(sql(q)).toBe(
      'UPDATE "leave_requests" SET "status" = $1 WHERE "leave_requests"."id" = $2 RETURNING *',
    );
  });
});

describe('result shape', () => {
  const exec = (rows: unknown[]): Executor => ({
    query: async () => ({ rows: rows as Record<string, unknown>[], rowCount: rows.length }),
  });
  const sp = Promise.resolve(schema);

  it('returns an array by default', async () => {
    const r = await new QueryBuilder(exec([{ id: 1 }, { id: 2 }]), sp, 'leave_requests').select('*');
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(2);
  });

  it('single() unwraps one row', async () => {
    const r = await new QueryBuilder(exec([{ id: 1 }]), sp, 'leave_requests').select('*').single();
    expect(r.data).toEqual({ id: 1 });
  });

  it('single() on zero rows reports PGRST116 rather than throwing', async () => {
    const r = await new QueryBuilder(exec([]), sp, 'leave_requests').select('*').single();
    expect(r.data).toBeNull();
    expect(r.error?.code).toBe('PGRST116');
  });

  it('maybeSingle() on zero rows is not an error', async () => {
    const r = await new QueryBuilder(exec([]), sp, 'leave_requests').select('*').maybeSingle();
    expect(r.data).toBeNull();
    expect(r.error).toBeNull();
  });

  it('surfaces the native unique-violation SQLSTATE the services check for', async () => {
    const failing: Executor = {
      query: async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); },
    };
    const r = await new QueryBuilder(failing, sp, 'leave_requests').insert({ a: 1 }).select('*');
    expect(r.error?.code).toBe('23505');
  });

  it('a write without .select() returns no data, like supabase-js', async () => {
    const r = await new QueryBuilder(exec([{ id: 1 }]), sp, 'leave_requests')
      .update({ status: 'x' }).eq('id', '1');
    expect(r.data).toBeNull();
    expect(r.error).toBeNull();
  });
});

// Regression: writing a JS array to a jsonb column.
//
// node-postgres turns an array parameter into a POSTGRES ARRAY literal, so
// ['a','b'] reaches Postgres as {"a","b"} and a jsonb column rejects it with
// 22P02 "invalid input syntax for type json". Empty arrays are worse: [] is
// sent as {}, which Postgres happily stores as an empty JSON OBJECT - that is
// how an employee ended up with identity_documents = {} and broke every
// `for...of` over that column.
describe('json column encoding on writes', () => {
  const docs = [{ type: 'passport', expiry: '2030-12-30' }];

  it('JSON-encodes an array bound to a jsonb column on update', () => {
    const q = compileUpdate('employees', { identity_documents: docs }, [], '*', schema);
    expect(q.values[0]).toBe(JSON.stringify(docs));
    expect(typeof q.values[0]).toBe('string');
  });

  it('keeps an empty array an ARRAY, not an object', () => {
    const q = compileUpdate('employees', { identity_documents: [] }, [], '*', schema);
    // '[]' not '{}' — the whole point.
    expect(q.values[0]).toBe('[]');
  });

  it('JSON-encodes on insert too', () => {
    const q = compileInsert('employees', [{ identity_documents: docs }], '*', undefined, schema);
    expect(q.values[0]).toBe(JSON.stringify(docs));
  });

  it('leaves non-json columns alone so real Postgres arrays still work', () => {
    const q = compileUpdate('employees', { tags: ['a', 'b'] }, [], '*', schema);
    // Untouched: node-postgres must encode this one as an array literal.
    expect(q.values[0]).toEqual(['a', 'b']);
  });

  it('passes null through unchanged', () => {
    const q = compileUpdate('employees', { identity_documents: null }, [], '*', schema);
    expect(q.values[0]).toBeNull();
  });

  it('does not encode scalars in a json column', () => {
    const q = compileUpdate('employees', { identity_documents: 'already-a-string' }, [], '*', schema);
    expect(q.values[0]).toBe('already-a-string');
  });
});

// Regression: the CSV exports were hard-500 in production.
//
// They used `clients!inner(...)`. The shim reads `!x` as an FK column or
// constraint hint, "inner" matches neither, and resolveEmbed throws — so both
// exports returned "Internal server error". Nothing exercised these select
// strings, which is exactly why it reached users.
//
// `!inner` was redundant anyway: invoices.client_id, timesheets.client_id and
// timesheets.employee_id are all NOT NULL, so INNER and LEFT return identical
// rows.
describe('CSV export select strings compile', () => {
  const build = (table: string, select: string) =>
    compileSelectQuery(
      { table, nodes: parseSelect(select), filters: [], orders: [] },
      schema,
    );

  it('compiles the invoices export select', () => {
    const q = build('invoices',
      'invoice_number, issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, paid_at, clients(company_name, display_id)');
    expect(sql(q)).toContain('AS "clients"');
    expect(sql(q)).toContain('_t0."id" = _r."client_id"');
  });

  it('compiles the timesheets export select', () => {
    const q = build('timesheets',
      'display_id, week_start_date, week_end_date, total_hours, status, submitted_at, notes, employees(first_name, last_name, display_id), clients(company_name, display_id)');
    expect(sql(q)).toContain('AS "employees"');
    expect(sql(q)).toContain('AS "clients"');
  });

  // Pin the actual failure, so re-introducing !inner fails here rather than in
  // production.
  it('rejects an !inner hint rather than silently mis-joining', () => {
    expect(() => build('invoices', 'invoice_number, clients!inner(company_name)'))
      .toThrow(/no foreign key relates/);
  });
});
