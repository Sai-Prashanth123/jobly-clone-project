import { describe, it, expect } from 'vitest';
import { isInfrastructureError, INFRA_SQLSTATES } from './builder';
import { appErrorFromDbError } from '../dbErrors';

// This exists because of a live incident during the audit. Adding
// `options: '-c TimeZone=UTC'` to the pool made RDS Proxy reject every
// connection — and the API did not report an error. It answered
//
//     404 {"success":false,"error":"Invoice not found"}
//
// in under 4ms for every record in the app, with nothing in CloudWatch, because
// ~128 call sites read `if (error || !data) throw new NotFoundError(...)` and
// that OR cannot tell "no such row" from "no database".
//
// The shim now rethrows infrastructure failures instead of returning them in the
// result, so they bypass those checks and reach the error handler as a 503.
describe('isInfrastructureError', () => {
  it.each([
    ['08006', 'connection_failure'],
    ['08003', 'connection_does_not_exist'],
    ['08P01', 'protocol_violation'],
    ['57P01', 'admin_shutdown'],
    ['53300', 'too_many_connections'],
  ])('treats SQLSTATE %s (%s) as infrastructure', (code) => {
    expect(isInfrastructureError({ code })).toBe(true);
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'])(
    'treats socket errno %s as infrastructure',
    (code) => {
      expect(isInfrastructureError({ code })).toBe(true);
    },
  );

  it.each([
    'Connection terminated unexpectedly',
    'timeout exceeded when trying to connect',
    'Client has encountered a connection error and is not queryable',
  ])('matches pg pool message %j', (message) => {
    expect(isInfrastructureError({ message })).toBe(true);
  });

  // The critical negatives. If these were treated as infrastructure they would
  // start throwing instead of returning a result, and the ~500 call sites that
  // branch on `error` would break.
  it.each([
    ['23505', 'unique violation — callers check this to report a duplicate'],
    ['PGRST116', 'no rows — this is how .single() reports an empty result'],
    ['22P02', 'malformed uuid'],
    ['23503', 'foreign key violation'],
    ['42703', 'undefined column'],
  ])('does NOT treat %s as infrastructure (%s)', (code) => {
    expect(isInfrastructureError({ code })).toBe(false);
  });

  it('ignores non-objects', () => {
    expect(isInfrastructureError(null)).toBe(false);
    expect(isInfrastructureError(undefined)).toBe(false);
    expect(isInfrastructureError('ECONNREFUSED')).toBe(false);
    expect(isInfrastructureError({})).toBe(false);
  });

  // The two halves have to agree: anything the shim throws must be something
  // the handler can turn into a 503, or it becomes an opaque 500 instead.
  // Iterates the REAL list rather than a copy, so adding a SQLSTATE to the shim
  // without teaching dbErrors.ts about it fails here instead of silently
  // producing an opaque 500 in production.
  it('every infrastructure SQLSTATE is classified as a 5xx by the handler', () => {
    const unmapped: string[] = [];
    for (const code of INFRA_SQLSTATES) {
      const mapped = appErrorFromDbError({ code, message: 'x' });
      if (!mapped || mapped.statusCode < 500) unmapped.push(code);
    }
    expect(
      unmapped,
      `these are rethrown by the shim but unmapped in dbErrors.ts, so they would `
      + `surface as an opaque 500: ${unmapped.join(', ')}`,
    ).toEqual([]);
  });
});
