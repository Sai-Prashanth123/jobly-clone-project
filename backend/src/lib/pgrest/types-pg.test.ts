import { describe, it, expect } from 'vitest';
import { pgrestTypes, pgTimestampToJson } from './types-pg';

// Resolve a parser the way node-postgres will at runtime.
const parserFor = (oid: number) => pgrestTypes.getTypeParser!(oid, 'text') as (raw: string) => unknown;

const DATE = 1082;
const TIMESTAMP = 1114;
const TIMESTAMPTZ = 1184;
const DATE_ARRAY = 1182;
const NUMERIC = 1700;
const INT8 = 20;
const TEXT = 25;

describe('pgrest type parsers', () => {
  // The bug this exists to prevent: node-postgres hands back a Date, the
  // services were written for PostgREST's JSON string, and formatDateSafe
  // does dateStr.slice(0, 10) -> "dateStr.slice is not a function" -> 500.
  it('returns a date as a plain YYYY-MM-DD string, not a Date', () => {
    const value = parserFor(DATE)('2026-07-07');
    expect(value).toBe('2026-07-07');
    expect(value).not.toBeInstanceOf(Date);
    expect(typeof (value as string).slice).toBe('function');
  });

  it('does not shift a date across a timezone boundary', () => {
    // A Date built from a bare date takes the local zone, which is what moved
    // 2026-07-07 back to 2026-07-06 for anyone west of UTC. A string cannot.
    expect(parserFor(DATE)('2026-01-15')).toBe('2026-01-15');
    expect(parserFor(DATE)('2026-12-31')).toBe('2026-12-31');
  });

  it('spells timestamps the way to_json does', () => {
    expect(parserFor(TIMESTAMP)('2026-07-07 10:30:00')).toBe('2026-07-07T10:30:00');
    expect(parserFor(TIMESTAMPTZ)('2026-07-07 10:30:00+00')).toBe('2026-07-07T10:30:00+00:00');
    expect(parserFor(TIMESTAMPTZ)('2026-07-07 10:30:00-05')).toBe('2026-07-07T10:30:00-05:00');
  });

  it('keeps sub-second precision', () => {
    expect(parserFor(TIMESTAMPTZ)('2026-07-07 18:06:12.127+00')).toBe('2026-07-07T18:06:12.127+00:00');
  });

  it('leaves an already-offset-qualified timestamp alone', () => {
    expect(pgTimestampToJson('2026-07-07 10:30:00+05:30')).toBe('2026-07-07T10:30:00+05:30');
  });

  it('passes infinity through untouched', () => {
    expect(parserFor(TIMESTAMP)('infinity')).toBe('infinity');
    expect(parserFor(TIMESTAMP)('-infinity')).toBe('-infinity');
  });

  it('parses date arrays element-wise, preserving NULLs', () => {
    expect(parserFor(DATE_ARRAY)('{2026-07-07,2026-07-08}')).toEqual(['2026-07-07', '2026-07-08']);
    expect(parserFor(DATE_ARRAY)('{2026-07-07,NULL}')).toEqual(['2026-07-07', null]);
  });

  it('leaves every other type on the stock parser', () => {
    // numeric/int8 stay strings on purpose - see the note in types-pg.ts.
    expect(parserFor(NUMERIC)('17600.00')).toBe('17600.00');
    expect(parserFor(INT8)('9007199254740993')).toBe('9007199254740993');
    expect(parserFor(TEXT)('hello')).toBe('hello');
  });
});
