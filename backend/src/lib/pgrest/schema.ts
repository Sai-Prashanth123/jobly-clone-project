// Foreign-key and primary-key introspection.
//
// PostgREST resolves embedded resources - select('*, employees!employee_id(..)')
// - by looking at the foreign keys between the two tables. To reproduce that
// against plain Postgres we need the same FK graph, so we read it once from
// the catalog and cache it for the life of the process.
//
// Read from pg_constraint rather than information_schema: the latter needs a
// three-way join through key_column_usage/constraint_column_usage that gets
// the column ORDER wrong on composite keys, which would silently mis-pair
// columns.
import type { Pool, QueryResult } from 'pg';

export interface FkEdge {
  /** Table holding the FK column (the "child" / referencing side). */
  table: string;
  column: string;
  /** Table being pointed at (the "parent" / referenced side). */
  refTable: string;
  refColumn: string;
  constraint: string;
}

export interface SchemaInfo {
  fks: FkEdge[];
  /** table -> primary key columns, in key order. */
  pks: Map<string, string[]>;
}

/**
 * How an embedded resource hangs off its parent.
 *
 * `toOne`  - the parent row holds the FK, so there is at most one match and
 *            PostgREST returns an object (or null).
 * `toMany` - the child rows hold the FK, so PostgREST returns an array.
 */
export interface EmbedLink {
  kind: 'toOne' | 'toMany';
  /** Column on the parent side of the comparison. */
  parentColumn: string;
  /** Column on the embedded table's side. */
  childColumn: string;
}

const FK_QUERY = `
  SELECT con.conname                         AS constraint,
         child.relname                       AS table,
         childatt.attname                    AS column,
         parent.relname                      AS ref_table,
         parentatt.attname                   AS ref_column
    FROM pg_constraint con
    JOIN pg_class child  ON child.oid  = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    -- WITH ORDINALITY keeps conkey/confkey aligned pairwise; without it a
    -- composite FK would cross-join into every column combination.
    JOIN LATERAL unnest(con.conkey)  WITH ORDINALITY AS c(attnum, ord) ON TRUE
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS p(attnum, ord) ON p.ord = c.ord
    JOIN pg_attribute childatt  ON childatt.attrelid  = con.conrelid
                               AND childatt.attnum    = c.attnum
    JOIN pg_attribute parentatt ON parentatt.attrelid = con.confrelid
                               AND parentatt.attnum   = p.attnum
   WHERE con.contype = 'f'
     AND child.relnamespace = 'public'::regnamespace
`;

const PK_QUERY = `
  SELECT rel.relname AS table,
         att.attname AS column,
         c.ord       AS ord
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS c(attnum, ord) ON TRUE
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = c.attnum
   WHERE con.contype = 'p'
     AND rel.relnamespace = 'public'::regnamespace
   ORDER BY rel.relname, c.ord
`;

let cached: Promise<SchemaInfo> | null = null;

/**
 * Run the two introspection queries, retrying a few times on a cold pool.
 *
 * Two separate problems are being handled here, both seen in production:
 *
 * 1. Promise.all adopts only the FIRST rejection. A connection blip takes out
 *    BOTH queries, so the second rejection had no handler attached and Node
 *    reported an unhandledRejection - which the Lambda runtime treats as
 *    fatal and kills the whole invocation. So a brief network hiccup during
 *    cold start turned into a hard 500 on whatever page the user was opening
 *    (Enrollment Form, Templates, Expiring Documents...). allSettled attaches
 *    a handler to both, so neither can dangle.
 *
 * 2. This runs once per Lambda container, on its very first query, when the
 *    VPC ENI and the pooled TLS connection to RDS Proxy are both cold. The
 *    database itself is idle when this happens - 7 connections, 5% CPU - so
 *    it is a transient connection-layer failure, not load. Retrying costs a
 *    few hundred milliseconds on the rare bad start and avoids failing the
 *    request outright.
 */
async function introspect(pool: Pool, attempts = 3): Promise<[QueryResult, QueryResult]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const [fk, pk] = await Promise.allSettled([pool.query(FK_QUERY), pool.query(PK_QUERY)]);
    if (fk.status === 'fulfilled' && pk.status === 'fulfilled') return [fk.value, pk.value];
    lastErr = fk.status === 'rejected' ? fk.reason : (pk as PromiseRejectedResult).reason;
    if (i < attempts - 1) {
      // Short backoff: 200ms then 600ms. Long enough for a cold ENI or a
      // re-dialled proxy connection, short enough that the user just sees a
      // slightly slow page rather than an error.
      await new Promise(r => setTimeout(r, 200 * 3 ** i));
    }
  }
  throw lastErr;
}

export function loadSchema(pool: Pool): Promise<SchemaInfo> {
  // Cache the promise, not the result: concurrent callers during startup then
  // share one round trip instead of each firing their own introspection.
  if (!cached) {
    cached = (async () => {
      const [fkRes, pkRes] = await introspect(pool);

      const fks: FkEdge[] = fkRes.rows.map(r => ({
        table: r.table,
        column: r.column,
        refTable: r.ref_table,
        refColumn: r.ref_column,
        constraint: r.constraint,
      }));

      const pks = new Map<string, string[]>();
      for (const r of pkRes.rows) {
        const list = pks.get(r.table) ?? [];
        list.push(r.column);
        pks.set(r.table, list);
      }

      return { fks, pks };
    })().catch(err => {
      // Don't cache a failure - a transient error at boot would otherwise
      // poison every later query for the life of the process.
      cached = null;
      throw err;
    });
  }
  return cached;
}

/** Test seam: forget the cached introspection. */
export function resetSchemaCache(): void {
  cached = null;
}

/**
 * Work out how `embedTable` relates to `parentTable`, honouring PostgREST's
 * `!hint` disambiguator. The hint may name either the FK column or the FK
 * constraint, which is what PostgREST itself accepts.
 */
export function resolveEmbed(
  schema: SchemaInfo,
  parentTable: string,
  embedTable: string,
  hint?: string,
): EmbedLink {
  const matchesHint = (e: FkEdge) => !hint || e.column === hint || e.constraint === hint;

  // Parent holds the FK -> at most one embedded row.
  const toOne = schema.fks.filter(
    e => e.table === parentTable && e.refTable === embedTable && matchesHint(e),
  );
  // Embedded table holds the FK -> many embedded rows.
  const toMany = schema.fks.filter(
    e => e.table === embedTable && e.refTable === parentTable && matchesHint(e),
  );

  const total = toOne.length + toMany.length;
  if (total === 0) {
    throw new Error(
      `pgrest: no foreign key relates "${parentTable}" to "${embedTable}"` +
        (hint ? ` via hint "${hint}"` : '') +
        '. Add a hint (table!fk_column) or check the select string.',
    );
  }
  if (total > 1) {
    // Several FKs join the same pair of tables (e.g. case_notes.author_id and
    // case_notes.tagged_to both point at portal_users). Guessing would quietly
    // return the wrong person, so demand the hint instead.
    const opts = [...toOne, ...toMany].map(e => `${e.table}!${e.column}`).join(', ');
    throw new Error(
      `pgrest: "${parentTable}" -> "${embedTable}" is ambiguous (${opts}). ` +
        'Disambiguate with table!fk_column.',
    );
  }

  if (toOne.length === 1) {
    const e = toOne[0];
    return { kind: 'toOne', parentColumn: e.column, childColumn: e.refColumn };
  }
  const e = toMany[0];
  return { kind: 'toMany', parentColumn: e.refColumn, childColumn: e.column };
}

/** Primary key of a table; used to re-read rows after a write that wants embeds. */
export function primaryKey(schema: SchemaInfo, table: string): string[] {
  const pk = schema.pks.get(table);
  if (!pk || pk.length === 0) {
    throw new Error(`pgrest: table "${table}" has no primary key`);
  }
  return pk;
}
