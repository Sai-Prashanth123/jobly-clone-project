// Filter compilation: supabase-js filter calls -> parameterised SQL.
//
// Every value goes through Params.add(), so nothing is ever interpolated into
// the SQL text. That matters more here than usual: several .or() strings in the
// services are built from user-supplied search terms.

export class Params {
  readonly values: unknown[] = [];

  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

export type Filter =
  | { kind: 'op'; column: string; op: string; value: unknown }
  | { kind: 'is'; column: string; value: null | boolean }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'contains'; column: string; values: unknown[] }
  | { kind: 'not'; inner: Filter }
  | { kind: 'or'; parts: Filter[] }
  | { kind: 'and'; parts: Filter[] };

const SQL_OPS: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'ILIKE',
};

/** Double-quote an identifier so reserved words and casing survive. */
export function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`pgrest: unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

/** Qualified column reference, e.g. _r."status". */
export function col(alias: string, column: string): string {
  return `${alias}.${ident(column)}`;
}

export function compileFilter(f: Filter, alias: string, p: Params): string {
  switch (f.kind) {
    case 'op': {
      const sql = SQL_OPS[f.op];
      if (!sql) throw new Error(`pgrest: unsupported operator "${f.op}"`);
      return `${col(alias, f.column)} ${sql} ${p.add(f.value)}`;
    }
    case 'is':
      // IS NULL / IS TRUE / IS FALSE cannot take a bind parameter.
      if (f.value === null) return `${col(alias, f.column)} IS NULL`;
      return `${col(alias, f.column)} IS ${f.value ? 'TRUE' : 'FALSE'}`;
    case 'in':
      // = ANY($1) takes the list as a single array parameter, which sidesteps
      // building an N-placeholder list and the 65535-parameter ceiling.
      if (f.values.length === 0) return 'FALSE';
      return `${col(alias, f.column)} = ANY(${p.add(f.values)})`;
    case 'contains':
      // Array containment: target_roles @> ARRAY['admin'].
      return `${col(alias, f.column)} @> ${p.add(f.values)}`;
    case 'not':
      return `NOT (${compileFilter(f.inner, alias, p)})`;
    case 'or':
      if (f.parts.length === 0) return 'TRUE';
      return `(${f.parts.map(x => compileFilter(x, alias, p)).join(' OR ')})`;
    case 'and':
      if (f.parts.length === 0) return 'TRUE';
      return `(${f.parts.map(x => compileFilter(x, alias, p)).join(' AND ')})`;
  }
}

export function compileWhere(filters: Filter[], alias: string, p: Params): string {
  if (filters.length === 0) return '';
  return ' WHERE ' + filters.map(f => compileFilter(f, alias, p)).join(' AND ');
}

/**
 * Split on commas that are at the top level - i.e. not inside the {...} of an
 * array literal or the (...) of an `in` list. A naive split() would cut
 * `target_roles.cs.{admin,hr}` in half.
 */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim() !== '') out.push(buf);
  return out;
}

/** Parse a PostgREST array literal: '{}' -> [], '{a,b}' -> ['a','b']. */
function parseArrayLiteral(v: string): string[] {
  const inner = v.slice(1, -1).trim();
  if (inner === '') return [];
  return splitTopLevel(inner).map(x => x.trim());
}

/**
 * Parse one PostgREST filter term: `column.operator.value`.
 *
 * Only the first two dots are separators - values routinely contain dots
 * (email addresses, ISO timestamps), so this splits by index rather than by
 * String.split('.').
 */
export function parseFilterTerm(term: string): Filter {
  const t = term.trim();
  const d1 = t.indexOf('.');
  const d2 = t.indexOf('.', d1 + 1);
  if (d1 < 0 || d2 < 0) {
    throw new Error(`pgrest: malformed filter term "${term}" (expected column.op.value)`);
  }
  const column = t.slice(0, d1);
  const op = t.slice(d1 + 1, d2);
  const raw = t.slice(d2 + 1);

  if (op === 'is') {
    if (raw === 'null') return { kind: 'is', column, value: null };
    if (raw === 'true') return { kind: 'is', column, value: true };
    if (raw === 'false') return { kind: 'is', column, value: false };
    throw new Error(`pgrest: "is" expects null/true/false, got "${raw}"`);
  }
  if (op === 'cs') {
    return { kind: 'contains', column, values: parseArrayLiteral(raw) };
  }
  if (op === 'in') {
    const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
    const values = inner.trim() === '' ? [] : splitTopLevel(inner).map(x => stripQuotes(x.trim()));
    return { kind: 'in', column, values };
  }
  if (op === 'eq' && raw.startsWith('{') && raw.endsWith('}')) {
    // `target_roles.eq.{}` compares an array column to an array literal.
    return { kind: 'op', column, op: 'eq', value: parseArrayLiteral(raw) };
  }
  if (!SQL_OPS[op]) {
    throw new Error(`pgrest: unsupported operator "${op}" in filter term "${term}"`);
  }
  return { kind: 'op', column, op, value: stripQuotes(raw) };
}

function stripQuotes(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
}

/** Parse the comma-separated argument of .or('a.eq.1,b.ilike.%x%'). */
export function parseOr(expr: string): Filter {
  const parts = splitTopLevel(expr).map(parseFilterTerm);
  return { kind: 'or', parts };
}
