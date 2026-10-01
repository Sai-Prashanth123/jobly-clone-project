import { AppError, ConflictError, ValidationError } from './errors';

// Turn a Postgres error into something the API can say out loud.
//
// The services carry ~128 raw `if (error) throw error` sites. That error is a
// plain PgrestError object, not an AppError and not even an Error, so
// errorHandler cannot classify it and every single database failure surfaces
// as `500 Internal server error` with no detail. Creating a second employee
// with an existing email — an ordinary thing for HR to do by accident — looked
// identical to the server being broken, and the only way to find out which was
// to read CloudWatch.
//
// Classifying here rather than at the 128 call sites means every one of them is
// fixed at once, including the ones nobody has looked at yet, and no service
// has to remember to wrap anything.
//
// The shim passes native SQLSTATEs straight through (see toPgrestError in
// lib/pgrest/builder.ts), so `code` is the real Postgres code.

/** `Key (email)=(a@b.com) already exists.` -> `email` */
function columnFromDetail(detail?: string | null): string | null {
  return detail?.match(/Key \(([^)]+)\)=/)?.[1] ?? null;
}

/** A human label for a column: `personal_email` -> `personal email`. */
const pretty = (col: string) => col.replace(/_/g, ' ');

interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  detail?: string | null;
  hint?: string | null;
}

/**
 * Map a database error onto an AppError, or return null if it is not a
 * database error this knows about — in which case the caller should keep
 * treating it as an unexpected 500.
 */
export function appErrorFromDbError(err: unknown): AppError | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as DbErrorLike;
  const code = typeof e.code === 'string' ? e.code : undefined;
  if (!code) return null;

  const detail = e.details ?? e.detail ?? null;

  switch (code) {
    // ── Constraint violations: the request is wrong, not the server ────────
    case '23505': {
      // unique_violation — duplicate email on employee/user create is the
      // common one, and it should be a 409 the UI can show on the field.
      const col = columnFromDetail(detail);
      return new ConflictError(
        col
          ? `A record with this ${pretty(col)} already exists.`
          : 'A record with these details already exists.',
        col ? { field: col } : undefined,
      );
    }
    case '23503':
      // foreign_key_violation — either pointing at something that is gone, or
      // deleting something still referenced. Both are the caller's problem.
      return new ConflictError(
        'This record is linked to other records, so it cannot be saved or removed yet.',
      );
    case '23502': {
      // not_null_violation
      const col = e.message?.match(/column "([^"]+)"/)?.[1];
      return new ValidationError(col ? `${pretty(col)} is required.` : 'A required field is missing.');
    }
    case '23514':
      return new ValidationError('One of the values is not allowed for this record.');
    case '22001':
      return new ValidationError('One of the values is too long.');
    case '22003':
      return new ValidationError('A number is out of the allowed range.');
    case '22P02':
      // invalid_text_representation — a malformed uuid or number in the path
      // or body. Today this is a 500 on a plainly bad request.
      return new ValidationError('One of the values is not in a valid format.');
    case '22007':
    case '22008':
      return new ValidationError('One of the dates is not in a valid format.');

    // ── Not the caller's fault, but still not "internal server error" ──────
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return new AppError('The request conflicted with another change. Please try again.', 409);
    case '57014': // query_canceled (statement timeout)
      return new AppError('The request took too long and was stopped. Please try a smaller range.', 503);
    case '53300': // too_many_connections
    case '53400': // configuration_limit_exceeded
      return new AppError('The service is briefly at capacity. Please try again in a moment.', 503);
    // Class 08 — connection_exception. These are rethrown by the shim (see
    // isInfrastructureError in lib/pgrest/builder.ts) rather than returned in
    // the result, so they must all be mapped here or they become opaque 500s;
    // infraErrors.test.ts iterates that list and fails if one is missing.
    case '08000': // connection_exception
    case '08001': // sqlclient_unable_to_establish_sqlconnection
    case '08003': // connection_does_not_exist
    case '08004': // sqlserver_rejected_establishment_of_sqlconnection
    case '08006': // connection_failure
    case '08007': // transaction_resolution_unknown
    case '08P01': // protocol_violation
      return new AppError('Could not reach the database. Please try again.', 503);
    case '57P01': // admin_shutdown
    case '57P02': // crash_shutdown
    case '57P03': // cannot_connect_now
      return new AppError('The database is restarting. Please try again in a moment.', 503);
    case '42501': // insufficient_privilege
      return new AppError('The server is not permitted to perform that action.', 500);

    default:
      // Unknown SQLSTATEs, and the shim's own PGRST* codes, keep the existing
      // behaviour: an opaque 500, logged in full. Deliberate — inventing a
      // status for an error nobody has looked at would hide real breakage.
      return null;
  }
}
