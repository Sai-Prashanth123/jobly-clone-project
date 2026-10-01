import { describe, it, expect } from 'vitest';
import { appErrorFromDbError } from './dbErrors';

// Before this, every one of the ~128 raw `throw error` sites in the services
// produced `500 Internal server error` with no detail, because the thrown value
// is a plain PgrestError object that errorHandler could not classify. HR
// creating a second employee with an existing email got the same opaque 500 as
// a genuinely broken server.
const pgError = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  message: 'db error',
  details: null,
  hint: null,
  ...extra,
});

describe('appErrorFromDbError', () => {
  it('turns a duplicate key into a 409 naming the field', () => {
    const e = appErrorFromDbError(
      pgError('23505', { details: 'Key (email)=(a@b.com) already exists.' }),
    );
    expect(e?.statusCode).toBe(409);
    expect(e?.message).toBe('A record with this email already exists.');
    expect(e?.details).toEqual({ field: 'email' });
  });

  it('reads the column from `detail` as well as `details`', () => {
    // node-postgres spells it `detail`; the shim copies it to `details`.
    // Whichever arrives, the field name should survive.
    const e = appErrorFromDbError(
      pgError('23505', { details: null, detail: 'Key (personal_email)=(x) already exists.' }),
    );
    expect(e?.details).toEqual({ field: 'personal_email' });
    expect(e?.message).toBe('A record with this personal email already exists.');
  });

  it('still gives a 409 when the detail does not name a column', () => {
    const e = appErrorFromDbError(pgError('23505'));
    expect(e?.statusCode).toBe(409);
    expect(e?.details).toBeUndefined();
  });

  it('maps a foreign key violation to 409 rather than 500', () => {
    expect(appErrorFromDbError(pgError('23503'))?.statusCode).toBe(409);
  });

  it('maps a not-null violation to 400, naming the column', () => {
    const e = appErrorFromDbError(
      pgError('23502', { message: 'null value in column "first_name" violates not-null constraint' }),
    );
    expect(e?.statusCode).toBe(400);
    expect(e?.message).toBe('first name is required.');
  });

  it('maps a malformed uuid to 400, not 500', () => {
    // A bad id in the path used to be an internal error.
    expect(appErrorFromDbError(pgError('22P02'))?.statusCode).toBe(400);
  });

  it.each([
    ['23514', 400],
    ['22001', 400],
    ['22003', 400],
    ['22007', 400],
    ['40001', 409],
    ['40P01', 409],
    ['57014', 503],
    ['53300', 503],
    ['08006', 503],
  ])('maps SQLSTATE %s to %i', (code, status) => {
    expect(appErrorFromDbError(pgError(code))?.statusCode).toBe(status);
  });

  // The important negative cases: this must not invent a status for anything
  // it has not been taught, or a real fault would be dressed up as a 4xx.
  it('leaves an unknown SQLSTATE alone', () => {
    expect(appErrorFromDbError(pgError('XX000'))).toBeNull();
  });

  it("leaves the shim's own codes alone", () => {
    expect(appErrorFromDbError(pgError('PGRST116'))).toBeNull();
    expect(appErrorFromDbError(pgError('PGRST000'))).toBeNull();
  });

  it('leaves a plain Error, null and a string alone', () => {
    expect(appErrorFromDbError(new Error('boom'))).toBeNull();
    expect(appErrorFromDbError(null)).toBeNull();
    expect(appErrorFromDbError('boom')).toBeNull();
    expect(appErrorFromDbError({ message: 'no code' })).toBeNull();
  });
});
