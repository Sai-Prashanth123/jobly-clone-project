/* eslint-disable @typescript-eslint/no-explicit-any */
// The supabase-js-shaped fluent builder, backed by SQL.
//
// `data` is typed `any` on purpose. The 496 call sites across the services
// were written against supabase-js's generated Database types and immediately
// cast the result (`data as Timesheet[]`). Typing it `unknown` here would
// require editing every one of those casts for no safety gain, since the cast
// is what actually establishes the type either way.
import { parseOr, ident, type Filter } from './filters';
import { parseSelect, hasEmbed, type SelectNode } from './select';
import {
  compileSelectQuery, compileCountQuery, compileInsert, compileUpdate, compileDelete,
  type OrderTerm,
} from './compile';
import { loadSchema, primaryKey, type SchemaInfo } from './schema';
import type { Pool } from 'pg';

export interface Executor {
  query(text: string, values: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

/** supabase-js returns errors in the result rather than throwing. */
export interface PgrestError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

export interface PgrestResult<T = any> {
  data: T;
  error: PgrestError | null;
  count: number | null;
  status: number;
}

type Row = Record<string, unknown>;
type Mode = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

/**
 * SQLSTATE classes (and node-postgres error codes) that mean "the database was
 * not reachable or the session died", as opposed to "the query was rejected".
 *
 * Class 08 is connection_exception, 57P01/02/03 are admin shutdown and
 * cannot_connect_now, 53300 is too_many_connections. node-postgres surfaces
 * socket-level failures with no SQLSTATE at all, so those are matched by the
 * Node errno codes instead.
 */
export const INFRA_SQLSTATES = new Set([
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
  '57P01', '57P02', '57P03', '53300',
]);
const INFRA_ERRNOS = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
  'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_SOCKET_CONNECTION_TIMEOUT',
]);

export function isInfrastructureError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && (INFRA_SQLSTATES.has(code) || INFRA_ERRNOS.has(code))) return true;
  // pg's own pool/connection messages carry no code worth matching on.
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' && (
    message.includes('Connection terminated')
    || message.includes('timeout exceeded when trying to connect')
    || message.includes('Client has encountered a connection error')
    || message.includes('server closed the connection unexpectedly')
  );
}

function toPgrestError(err: unknown): PgrestError {
  const e = err as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: e?.message ?? String(err),
    // Native SQLSTATEs pass straight through, so the `code === '23505'`
    // unique-violation checks in the services keep working unchanged.
    code: e?.code ?? 'PGRST000',
    details: e?.detail ?? null,
    hint: e?.hint ?? null,
  };
}

const NOT_ONE: PgrestError = {
  message: 'JSON object requested, multiple (or no) rows returned',
  code: 'PGRST116',
  details: null,
  hint: null,
};

export class QueryBuilder implements PromiseLike<PgrestResult> {
  private mode: Mode = 'select';
  private nodes: SelectNode[] = [{ kind: 'star' }];
  private selectRequested = false;
  private filters: Filter[] = [];
  private orders: OrderTerm[] = [];
  private limitN?: number;
  private offsetN?: number;
  private wantCount = false;
  private headOnly = false;
  private rowMode: 'many' | 'single' | 'maybe' = 'many';
  private payload: Row[] = [];
  private patch: Row = {};
  private onConflict?: string;
  private ran?: Promise<PgrestResult>;

  constructor(
    private readonly exec: Executor,
    private readonly schemaP: Promise<SchemaInfo>,
    private readonly table: string,
  ) {}

  // ---- shape ---------------------------------------------------------

  select(select?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this.nodes = parseSelect(select);
    this.selectRequested = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.mode = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[], opts?: { onConflict?: string }): this {
    this.mode = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    // Default to the primary key, which is what ON CONFLICT does with no target.
    this.onConflict = opts?.onConflict ?? '';
    return this;
  }

  update(patch: Row): this {
    this.mode = 'update';
    this.patch = patch;
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  // ---- filters -------------------------------------------------------

  private push(f: Filter): this {
    this.filters.push(f);
    return this;
  }

  eq(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'eq', value }); }
  neq(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'neq', value }); }
  gt(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'gt', value }); }
  gte(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'gte', value }); }
  lt(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'lt', value }); }
  lte(column: string, value: unknown): this { return this.push({ kind: 'op', column, op: 'lte', value }); }
  like(column: string, pattern: string): this { return this.push({ kind: 'op', column, op: 'like', value: pattern }); }
  ilike(column: string, pattern: string): this { return this.push({ kind: 'op', column, op: 'ilike', value: pattern }); }
  is(column: string, value: null | boolean): this { return this.push({ kind: 'is', column, value }); }
  in(column: string, values: unknown[]): this { return this.push({ kind: 'in', column, values }); }
  contains(column: string, values: unknown[]): this { return this.push({ kind: 'contains', column, values }); }

  match(obj: Row): this {
    for (const [column, value] of Object.entries(obj)) this.eq(column, value);
    return this;
  }

  or(expr: string): this {
    return this.push(parseOr(expr));
  }

  /**
   * .not(column, op, value) - e.g. .not('case_id', 'is', null), and the list
   * form .not('id', 'in', '(a,b,c)') that PostgREST accepts as a raw literal.
   */
  not(column: string, op: string, value: unknown): this {
    if (op === 'is') {
      return this.push({ kind: 'not', inner: { kind: 'is', column, value: value as null | boolean } });
    }
    if (op === 'in') {
      const values = Array.isArray(value)
        ? value
        : String(value).replace(/^\(|\)$/g, '').split(',').map(s => s.trim()).filter(s => s !== '');
      // NOT IN over an empty list must match everything, but `NOT (FALSE)` is
      // TRUE, so the compiled `in` already handles it correctly.
      return this.push({ kind: 'not', inner: { kind: 'in', column, values } });
    }
    return this.push({ kind: 'not', inner: { kind: 'op', column, op, value } });
  }

  // ---- ordering / paging --------------------------------------------

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  /** PostgREST ranges are inclusive at both ends. */
  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = Math.max(0, to - from + 1);
    return this;
  }

  single(): this {
    this.rowMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.rowMode = 'maybe';
    return this;
  }

  // ---- execution -----------------------------------------------------

  then<TResult1 = PgrestResult, TResult2 = never>(
    onfulfilled?: ((value: PgrestResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<PgrestResult> {
    // Memoised so awaiting the same builder twice does not re-issue the write.
    if (!this.ran) this.ran = this.run().catch(err => this.fail(err));
    return this.ran;
  }

  private fail(err: unknown): PgrestResult {
    // Infrastructure failures are RETHROWN rather than returned as a result.
    //
    // supabase-js reports query errors in the result, and ~500 call sites are
    // written for that. But ~128 of them read `if (error || !data) throw new
    // NotFoundError(...)`, which conflates "this row does not exist" with "the
    // database could not be reached" — so when every connection started failing
    // during this audit, the API answered a clean 404 "Invoice not found" in
    // under 4ms for every record in the app, with nothing logged. It looked
    // exactly like an empty database rather than a broken one.
    //
    // A connection failure is never something a call site can handle
    // meaningfully, so throwing is strictly better: it skips those 128 checks
    // entirely and lands in errorHandler, which maps it (via lib/dbErrors.ts)
    // to a 503 that says the database is unreachable. Query-level errors —
    // PGRST116, constraint violations, bad filters — keep the existing
    // in-result contract, because call sites genuinely branch on those.
    if (isInfrastructureError(err)) throw err;
    return { data: null, error: toPgrestError(err), count: null, status: 400 };
  }

  private finish(rows: any[], count: number | null): PgrestResult {
    if (this.rowMode === 'many') {
      return { data: rows, error: null, count, status: 200 };
    }
    if (rows.length === 1) {
      return { data: rows[0], error: null, count, status: 200 };
    }
    if (rows.length === 0 && this.rowMode === 'maybe') {
      return { data: null, error: null, count, status: 200 };
    }
    return { data: null, error: NOT_ONE, count, status: 406 };
  }

  private async run(): Promise<PgrestResult> {
    const schema = await this.schemaP;

    if (this.mode === 'select') {
      const spec = {
        table: this.table,
        nodes: this.nodes,
        filters: this.filters,
        orders: this.orders,
        limit: this.limitN,
        offset: this.offsetN,
      };

      let count: number | null = null;
      if (this.wantCount) {
        const c = compileCountQuery(spec, schema);
        const res = await this.exec.query(c.text, c.values);
        count = Number(res.rows[0]?.count ?? 0);
      }
      // head:true asks for the count only - skip the row query entirely.
      if (this.headOnly) return { data: [], error: null, count, status: 200 };

      const q = compileSelectQuery(spec, schema);
      const res = await this.exec.query(q.text, q.values);
      return this.finish(res.rows, count);
    }

    return this.runWrite(schema);
  }

  private async runWrite(schema: SchemaInfo): Promise<PgrestResult> {
    // supabase-js only returns rows when .select() was called on the chain.
    // Without it, RETURNING the primary key is still needed for the embed
    // re-read path but the caller gets data: null.
    const pk = primaryKey(schema, this.table);
    const wantEmbeds = this.selectRequested && hasEmbed(this.nodes);
    const returning = wantEmbeds || !this.selectRequested
      ? pk.map(ident).join(', ')
      : '*';

    let q;
    if (this.mode === 'insert') {
      q = compileInsert(this.table, this.payload, returning, undefined, schema);
    } else if (this.mode === 'upsert') {
      const target = this.onConflict !== undefined && this.onConflict !== ''
        ? this.onConflict
        : pk.join(',');
      q = compileInsert(this.table, this.payload, returning, target, schema);
    } else if (this.mode === 'update') {
      q = compileUpdate(this.table, this.patch, this.filters, returning, schema);
    } else {
      q = compileDelete(this.table, this.filters, returning);
    }

    const res = await this.exec.query(q.text, q.values);

    if (!this.selectRequested) {
      return { data: null, error: null, count: null, status: 204 };
    }
    if (!wantEmbeds) {
      return this.finish(res.rows, null);
    }

    // Embeds cannot be built in a RETURNING clause, so re-read the affected
    // rows by primary key. DELETE never gets here - its rows are gone - but
    // the services only ask for embeds after insert/update.
    if (res.rows.length === 0) return this.finish([], null);

    const readback = new QueryBuilder(this.exec, this.schemaP, this.table);
    readback.nodes = this.nodes;
    readback.selectRequested = true;
    readback.rowMode = this.rowMode;
    readback.orders = this.orders;
    if (pk.length === 1) {
      readback.in(pk[0], res.rows.map(r => r[pk[0]]));
    } else {
      // Composite key: OR together one AND-group of equalities per row.
      readback.push({
        kind: 'or',
        parts: res.rows.map(r => ({
          kind: 'and' as const,
          parts: pk.map(k => ({ kind: 'op' as const, column: k, op: 'eq', value: r[k] })),
        })),
      });
    }
    return readback.execute();
  }

  /** Escape hatch for tests: the SQL this builder would run. */
  toSQL(schema: SchemaInfo): { text: string; values: unknown[] } {
    return compileSelectQuery(
      {
        table: this.table,
        nodes: this.nodes,
        filters: this.filters,
        orders: this.orders,
        limit: this.limitN,
        offset: this.offsetN,
      },
      schema,
    );
  }
}

export interface PgrestClient {
  from(table: string): QueryBuilder;
}

/**
 * The pool doubles as the executor: pool.query() checks a connection out and
 * back per statement, which is exactly the behaviour each PostgREST call had.
 */
export function createPgrest(pool: Pool): PgrestClient {
  const schemaP = loadSchema(pool);
  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(pool as unknown as Executor, schemaP, table);
    },
  };
}
