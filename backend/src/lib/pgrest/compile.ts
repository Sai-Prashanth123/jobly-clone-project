// SQL generation: a parsed select tree + filters -> one statement.
//
// Embedded resources become correlated JSON subqueries rather than joins. A
// LEFT JOIN would multiply the parent row once per child and force the caller
// to de-duplicate; json_agg keeps one row per parent and hands back exactly the
// nested shape PostgREST produces, so the services need no changes.
import {
  Params, compileWhere, compileFilter, col, ident, type Filter,
} from './filters';
import type { SelectNode } from './select';
import { resolveEmbed, type SchemaInfo } from './schema';

export interface OrderTerm {
  column: string;
  ascending: boolean;
}

export interface QuerySpec {
  table: string;
  nodes: SelectNode[];
  filters: Filter[];
  orders: OrderTerm[];
  limit?: number;
  offset?: number;
}

/** Generates _r, _t0, _t1 ... so nested subqueries never shadow each other. */
class AliasGen {
  private n = 0;
  next(): string {
    return `_t${this.n++}`;
  }
}

function compileOrder(orders: OrderTerm[], alias: string): string {
  if (orders.length === 0) return '';
  // PostgREST's null placement matches Postgres' own default (ASC -> NULLS
  // LAST, DESC -> NULLS FIRST), so no explicit NULLS clause is needed.
  const terms = orders.map(o => `${col(alias, o.column)} ${o.ascending ? 'ASC' : 'DESC'}`);
  return ` ORDER BY ${terms.join(', ')}`;
}

/**
 * Build the select-list expressions for one level of the tree.
 * `alias` is the SQL alias of the table these nodes belong to.
 */
function compileSelectList(
  nodes: SelectNode[],
  table: string,
  alias: string,
  schema: SchemaInfo,
  p: Params,
  gen: AliasGen,
): string[] {
  const out: string[] = [];

  for (const node of nodes) {
    if (node.kind === 'star') {
      out.push(`${alias}.*`);
      continue;
    }

    if (node.kind === 'column') {
      const ref = col(alias, node.name);
      out.push(node.alias ? `${ref} AS ${ident(node.alias)}` : ref);
      continue;
    }

    // Embedded resource.
    const link = resolveEmbed(schema, table, node.table, node.hint);
    const childAlias = gen.next();
    const innerAlias = gen.next();
    const key = node.alias ?? node.table;

    const childCols = compileSelectList(node.children, node.table, childAlias, schema, p, gen);
    const join = `${col(childAlias, link.childColumn)} = ${col(alias, link.parentColumn)}`;
    const inner =
      `SELECT ${childCols.join(', ')} FROM ${ident(node.table)} ${childAlias} WHERE ${join}`;

    if (link.kind === 'toOne') {
      // No match -> the scalar subquery yields NULL, which is what PostgREST
      // returns for an unmatched to-one embed.
      out.push(
        `(SELECT to_jsonb(${innerAlias}) FROM (${inner}) ${innerAlias}) AS ${ident(key)}`,
      );
    } else {
      // No matches -> '[]', never NULL. Services iterate these arrays directly.
      out.push(
        `(SELECT COALESCE(jsonb_agg(to_jsonb(${innerAlias})), '[]'::jsonb) ` +
          `FROM (${inner}) ${innerAlias}) AS ${ident(key)}`,
      );
    }
  }

  // '*' alone is valid, but an empty list is not.
  return out.length ? out : [`${alias}.*`];
}

export interface CompiledQuery {
  text: string;
  values: unknown[];
}

export function compileSelectQuery(spec: QuerySpec, schema: SchemaInfo): CompiledQuery {
  const p = new Params();
  const gen = new AliasGen();
  const root = '_r';

  const cols = compileSelectList(spec.nodes, spec.table, root, schema, p, gen);
  let text = `SELECT ${cols.join(', ')} FROM ${ident(spec.table)} ${root}`;
  text += compileWhere(spec.filters, root, p);
  text += compileOrder(spec.orders, root);
  if (spec.limit !== undefined) text += ` LIMIT ${p.add(spec.limit)}`;
  if (spec.offset !== undefined) text += ` OFFSET ${p.add(spec.offset)}`;

  return { text, values: p.values };
}

/**
 * The matching count query for { count: 'exact' }.
 *
 * Deliberately ignores limit/offset: PostgREST's count is the size of the full
 * filtered set, which is what the UI needs to render pagination.
 */
export function compileCountQuery(spec: QuerySpec, _schema: SchemaInfo): CompiledQuery {
  const p = new Params();
  const root = '_r';
  const text =
    `SELECT count(*)::bigint AS count FROM ${ident(spec.table)} ${root}` +
    compileWhere(spec.filters, root, p);
  return { text, values: p.values };
}

type Row = Record<string, unknown>;

/** Column order must be identical across a multi-row INSERT. */
function unionColumns(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

export function compileInsert(
  table: string,
  rows: Row[],
  returning: string,
  onConflict?: string,
): CompiledQuery {
  const p = new Params();
  const cols = unionColumns(rows);
  if (cols.length === 0) throw new Error('pgrest: insert with no columns');

  const tuples = rows.map(r => {
    // A key missing from this row but present in another must still get a
    // placeholder, or the tuple arity would not match the column list.
    const vals = cols.map(c => (c in r ? p.add(r[c]) : 'DEFAULT'));
    return `(${vals.join(', ')})`;
  });

  let text =
    `INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) VALUES ${tuples.join(', ')}`;

  if (onConflict !== undefined) {
    const target = onConflict.split(',').map(s => ident(s.trim())).join(', ');
    // Never overwrite the conflict key itself with itself; update the rest.
    const keys = new Set(onConflict.split(',').map(s => s.trim()));
    const updates = cols.filter(c => !keys.has(c)).map(c => `${ident(c)} = EXCLUDED.${ident(c)}`);
    text += updates.length
      ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.join(', ')}`
      : ` ON CONFLICT (${target}) DO NOTHING`;
  }

  text += ` RETURNING ${returning}`;
  return { text, values: p.values };
}

export function compileUpdate(
  table: string,
  patch: Row,
  filters: Filter[],
  returning: string,
): CompiledQuery {
  const p = new Params();
  const cols = Object.keys(patch);
  if (cols.length === 0) throw new Error('pgrest: update with no columns');

  const sets = cols.map(c => `${ident(c)} = ${p.add(patch[c])}`);
  // No alias: UPDATE ... SET uses bare column names on the left-hand side.
  const where = filters.length
    ? ' WHERE ' + filters.map(f => compileFilter(f, ident(table), p)).join(' AND ')
    : '';
  const text = `UPDATE ${ident(table)} SET ${sets.join(', ')}${where} RETURNING ${returning}`;
  return { text, values: p.values };
}

export function compileDelete(
  table: string,
  filters: Filter[],
  returning: string,
): CompiledQuery {
  const p = new Params();
  const where = filters.length
    ? ' WHERE ' + filters.map(f => compileFilter(f, ident(table), p)).join(' AND ')
    : '';
  const text = `DELETE FROM ${ident(table)}${where} RETURNING ${returning}`;
  return { text, values: p.values };
}
