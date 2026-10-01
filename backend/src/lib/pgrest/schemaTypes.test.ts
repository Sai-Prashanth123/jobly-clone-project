import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pgrestTypes } from './types-pg';

// Every Postgres column type the schema uses must have a DECIDED answer about
// what JS value it becomes — either node-postgres already matches what
// PostgREST produced, or types-pg.ts overrides it.
//
// This exists because three production bugs came from types nobody had decided
// about:
//   - date / timestamptz arrived as Date objects, so PDF generation 500'd on
//     `dateStr.slice is not a function` and every invoice send failed
//   - numeric arrived as strings, so totals concatenated instead of adding
//     (`timesheets.reduce(...).toFixed is not a function`)
//   - JS arrays bound to jsonb became Postgres array literals, which either
//     errored or silently stored {} where [] was written
//
// Adding a column of an undecided type should fail here, not in front of a user.
const schemaSql = readFileSync(join(__dirname, '..', '..', '..', 'rds', 'schema.sql'), 'utf8');

/** Types present in the schema whose JS representation has been verified. */
const DECIDED = new Set([
  'text',                     // string
  'uuid',                     // string
  'boolean',                  // boolean
  'integer',                  // number
  'jsonb',                    // parsed JSON on read; writes encoded in compile.ts
  'timestamp with time zone', // OVERRIDDEN -> string
  'date',                     // OVERRIDDEN -> string
  'numeric',                  // OVERRIDDEN -> number
  'time without time zone',   // pg already yields 'HH:MM:SS'
  'text[]',                   // pg already yields string[]
]);

/**
 * Types that WOULD diverge from PostgREST if introduced, and for which
 * types-pg.ts registers no override. Named explicitly so a failure says what
 * to do rather than just that something is wrong.
 */
const UNDECIDED_RISKS: Record<string, string> = {
  bigint: 'node-postgres returns a STRING, PostgREST returned a number',
  'double precision': 'verify precision handling before use',
  real: 'verify precision handling before use',
  interval: 'node-postgres returns an OBJECT, PostgREST returned a string',
  bytea: 'node-postgres returns a Buffer, PostgREST returned a hex string',
  'timestamp without time zone': 'no override registered, would arrive as a Date',
  'time with time zone': 'no override registered',
};

/** Does the schema declare at least one column of this type? */
function schemaUses(type: string): boolean {
  const escaped = type.replace(/[[\]]/g, m => '\\' + m);
  // A trailing \b cannot match after `]` — both it and the following space are
  // non-word characters, so there is no boundary between them, and `text[]`
  // silently never matched. Only word-ending types get the boundary.
  const boundary = /\w$/.test(type) ? '\\b' : '';
  // Column definitions look like:  `    some_column numeric(12,2) NOT NULL,`
  return new RegExp('^\\s+"?[a-z_]+"?\\s+' + escaped + boundary, 'm').test(schemaSql);
}

describe('column type contract', () => {
  it('every column type in schema.sql has a decided JS representation', () => {
    const undecided = Object.keys(UNDECIDED_RISKS).filter(schemaUses);
    expect(
      undecided,
      undecided.map(t => `${t}: ${UNDECIDED_RISKS[t]} — add a parser in types-pg.ts`).join('; '),
    ).toEqual([]);
  });

  it('the types it claims are present really are', () => {
    // Keeps DECIDED honest: if a type is dropped from the schema entirely,
    // this surfaces it rather than letting the list rot.
    const missing = [...DECIDED].filter(t => !schemaUses(t));
    expect(missing, `listed as decided but no longer in the schema: ${missing.join(', ')}`).toEqual([]);
  });

  it('the overrides still do what the contract says', () => {
    const parse = (oid: number, raw: string) =>
      (pgrestTypes.getTypeParser!(oid, 'text') as (s: string) => unknown)(raw);
    expect(parse(1082, '2026-01-01')).toBe('2026-01-01');                       // date
    expect(parse(1184, '2026-01-01 00:00:00+00')).toBe('2026-01-01T00:00:00+00:00'); // timestamptz
    expect(parse(1700, '1.50')).toBe(1.5);                                      // numeric
  });
});
