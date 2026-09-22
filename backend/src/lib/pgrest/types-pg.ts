// Type parsers that make node-postgres hand back the same JSON shapes
// PostgREST did.
//
// This shim exists so ~500 call sites written against supabase-js keep
// working unchanged against RDS. Those call sites were written when every
// value arrived as JSON over HTTP, so a date column was the STRING
// '2026-07-07'. node-postgres instead parses date/timestamp/timestamptz into
// JavaScript Date objects, which quietly broke that contract everywhere:
//
//   - `formatDateSafe(dateStr)` does `dateStr.slice(0, 10)` and threw
//     "dateStr.slice is not a function", 500ing every PDF (invoice send,
//     timesheets, the generated forms).
//   - A Date serialises back out to the frontend as a full ISO timestamp
//     ('2026-07-07T00:00:00.000Z'). Parsed with `new Date()` in a negative
//     UTC offset - i.e. every US user - that renders as the PREVIOUS day.
//
// Fixing it here rather than in each caller keeps the shim's promise: what
// comes out is what PostgREST would have produced. The strings below are
// Postgres' own text output, adjusted to the JSON spelling Postgres uses
// (`to_json`), which is what PostgREST serialises with.
//
// numeric is converted back to a JS number for the same reason. PostgREST
// emitted it as a JSON number, so supabase-js handed the services a number
// and they do arithmetic on it directly. node-postgres returns a string to
// protect precision, which turns every sum into string concatenation:
//
//   timesheets.reduce((s, t) => s + t.totalHours, 0)   // 0 + "8.00" -> "08.00"
//   ...that.toFixed(1)                                  // TypeError, 500
//
// and, worse, any total that did NOT go on to call a number-only method
// silently rendered as concatenated digits instead of a sum.
//
// Precision: a JS double holds ~15 significant digits. This schema's numerics
// are money and hours, nowhere near that, and PostgREST already round-tripped
// them through exactly this conversion - so matching it restores the
// behaviour the code was written against rather than inventing a new one.
// There are no bigint/double precision/real columns in this schema, so
// numeric is the only case that needs converting.
import type { CustomTypesConfig } from 'pg';
import { types } from 'pg';

// Postgres type OIDs. These are fixed by the catalog and safe to hardcode.
const OID = {
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  DATE_ARRAY: 1182,
  TIMESTAMP_ARRAY: 1115,
  TIMESTAMPTZ_ARRAY: 1185,
  NUMERIC: 1700,
  NUMERIC_ARRAY: 1231,
} as const;

/**
 * Postgres text output -> the JSON spelling `to_json` gives it.
 *
 * Postgres prints a timestamp as '2026-07-07 10:30:00' but renders it in JSON
 * as '2026-07-07T10:30:00', and prints a zone as '+00' where JSON uses
 * '+00:00'. A plain date has no time part and passes straight through.
 */
export function pgTimestampToJson(raw: string): string {
  if (!raw) return raw;
  // 'infinity' / '-infinity' have no date parts to reshape.
  if (raw === 'infinity' || raw === '-infinity') return raw;

  const withT = raw.replace(' ', 'T');
  // Expand a bare hour offset ('+00' / '-05') to the '+00:00' JSON form.
  // Anchored to the end so it cannot touch the date or time digits.
  return withT.replace(/([+-]\d{2})$/, '$1:00');
}

/** Pass the raw text through untouched - Postgres already prints YYYY-MM-DD. */
function parseDate(raw: string): string {
  return raw;
}

function parseTimestamp(raw: string): string {
  return pgTimestampToJson(raw);
}

/**
 * numeric -> JS number, the way JSON.parse produced it for supabase-js.
 *
 * Postgres can return the literal 'NaN' for a numeric; Number() maps that to
 * NaN, which is what JSON.parse would also have yielded.
 */
export function parseNumeric(raw: string): number {
  return Number(raw);
}

// Arrays reuse node-postgres' own array splitter so quoting and NULLs stay
// handled for us. It has to be the TEXT array parser (OID 1009): the
// date/timestamp array parsers would convert each element to a Date before we
// ever saw it, which is the exact thing being undone here.
const TEXT_ARRAY_OID = 1009;
function arrayOf<T>(parse: (raw: string) => T) {
  // Cast: pg types getTypeParser's published signature only enumerates the
  // OIDs it ships named constants for, and text[] is not one of them.
  const splitArray = types.getTypeParser(TEXT_ARRAY_OID as never) as unknown as (v: string) => (string | null)[];
  return (raw: string): (T | null)[] =>
    splitArray(raw).map(el => (el === null ? null : parse(el)));
}

/**
 * Pool-scoped parser overrides. Passed as the Pool's `types` option rather
 * than calling `pg.types.setTypeParser`, which mutates global state shared by
 * every pool and every library in the process.
 */
export const pgrestTypes: CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: string) => {
    if (format === undefined || format === 'text') {
      switch (oid) {
        case OID.DATE:
          return parseDate;
        case OID.TIMESTAMP:
        case OID.TIMESTAMPTZ:
          return parseTimestamp;
        case OID.DATE_ARRAY:
          return arrayOf(parseDate);
        case OID.TIMESTAMP_ARRAY:
        case OID.TIMESTAMPTZ_ARRAY:
          return arrayOf(parseTimestamp);
        case OID.NUMERIC:
          return parseNumeric;
        case OID.NUMERIC_ARRAY:
          return arrayOf(parseNumeric);
      }
    }
    return types.getTypeParser(oid, format as never);
  }) as CustomTypesConfig['getTypeParser'],
};
