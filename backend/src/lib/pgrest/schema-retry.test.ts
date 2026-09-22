import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Pool } from 'pg';
import { loadSchema, resetSchemaCache } from './schema';

// Minimal stand-in: loadSchema only ever calls pool.query().
function fakePool(impl: () => Promise<unknown>): Pool {
  return { query: vi.fn(impl) } as unknown as Pool;
}
const ok = { rows: [] };

afterEach(() => {
  resetSchemaCache();
  vi.restoreAllMocks();
});

describe('schema introspection resilience', () => {
  it('succeeds first time when the pool is healthy', async () => {
    const pool = fakePool(() => Promise.resolve(ok));
    await expect(loadSchema(pool)).resolves.toEqual({ fks: [], pks: new Map() });
    expect(pool.query).toHaveBeenCalledTimes(2); // FK + PK, one attempt
  });

  it('retries a cold-start connection failure and then succeeds', async () => {
    let call = 0;
    // Both queries of the first attempt fail, exactly as a connection blip
    // takes out the whole pool; the second attempt is fine.
    const pool = fakePool(() => {
      call++;
      return call <= 2
        ? Promise.reject(new Error('Connection terminated due to connection timeout'))
        : Promise.resolve(ok);
    });
    await expect(loadSchema(pool)).resolves.toEqual({ fks: [], pks: new Map() });
    expect(pool.query).toHaveBeenCalledTimes(4); // 2 failed + 2 retried
  });

  // The regression that took pages down: Promise.all adopts only the first
  // rejection, so the second had no handler and Node raised an
  // unhandledRejection, which the Lambda runtime treats as fatal.
  it('never leaves a second rejection unhandled when both queries fail', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const pool = fakePool(() => Promise.reject(new Error('Connection terminated unexpectedly')));
      await expect(loadSchema(pool)).rejects.toThrow('Connection terminated unexpectedly');
      // Give Node a turn to report any dangling rejection.
      await new Promise(r => setTimeout(r, 50));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('does not cache a failure, so the next request can recover', async () => {
    let fail = true;
    const pool = fakePool(() => (fail ? Promise.reject(new Error('boom')) : Promise.resolve(ok)));
    await expect(loadSchema(pool)).rejects.toThrow('boom');
    fail = false;
    await expect(loadSchema(pool)).resolves.toEqual({ fks: [], pks: new Map() });
  });
});
