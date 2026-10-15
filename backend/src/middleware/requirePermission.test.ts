import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * requirePermission, exercised against a stubbed lookup.
 *
 * The behaviour worth pinning is not "it says yes when the table says yes" —
 * it is what happens when the table CANNOT answer. This system has had one
 * lockout from a password rotation and one access regression that HR reported
 * within hours, so the failure modes matter more than the happy path:
 *
 *   table says no        → no
 *   table says yes       → yes
 *   table unreachable    → the compiled-in roles, i.e. exactly today
 *   key unknown          → the compiled-in roles
 *   not authenticated    → no, without consulting anything
 *
 * Never "everything 403s" and never "everything opens".
 */

const may = vi.fn();
vi.mock('../services/permissions.service', () => ({ may: (...a: unknown[]) => may(...a) }));

import { requirePermission } from './rbac';

const run = async (role: string | null, guard: ReturnType<typeof requirePermission>) => {
  const req = { user: role ? { role } : undefined } as unknown as Request;
  let err: unknown = 'NOT_CALLED';
  const next: NextFunction = (e?: unknown) => { err = e ?? null; };
  await guard(req, {} as Response, next);
  return err;
};

const allowed = (e: unknown) => e === null;

// mockClear per test, never mockReset: resetting this mock between tests left
// it in a state whose error the runner attributed to whichever test ran next,
// failing three tests that the guard was in fact handling correctly.

describe('when the permission tables answer', () => {
  it('allows what they allow', async () => {
    may.mockResolvedValue(true);
    expect(allowed(await run('hr', requirePermission('clients.view', 'admin')))).toBe(true);
  });

  // The whole point of the feature: an admin's decision beats the code.
  it('refuses what they refuse, even for a role the code allows', async () => {
    may.mockResolvedValue(false);
    expect(allowed(await run('admin', requirePermission('clients.view', 'admin')))).toBe(false);
  });

  it('asks about the acting role and the given key', async () => {
    may.mockResolvedValue(true);
    await run('finance', requirePermission('invoices.view', 'admin', 'finance'));
    expect(may).toHaveBeenCalledWith('finance', 'invoices.view');
  });
});

describe('when the lookup fails', () => {
  // The failure is set up inside each test rather than in a beforeEach: a
  // mock configured to fail in beforeEach is attributed to the hook rather
  // than to the call, and the runner reports it as the test's own error even
  // though the guard catches it exactly as intended.
  const fails = () => may.mockImplementation(() => { throw new Error('database is down'); });

  // Not an outage...
  it('still admits a role the compiled-in list allows', async () => {
    fails();
    expect(allowed(await run('hr', requirePermission('clients.view', 'admin', 'hr')))).toBe(true);
  });

  // ...and not a free-for-all.
  it('still refuses a role it does not', async () => {
    fails();
    expect(allowed(await run('employee', requirePermission('clients.view', 'admin', 'hr')))).toBe(false);
  });

  it('refuses everybody when the compiled-in list is empty', async () => {
    fails();
    expect(allowed(await run('admin', requirePermission('nothing.atall')))).toBe(false);
  });
});

describe('before any lookup happens', () => {
  it('refuses an unauthenticated request without asking', async () => {
    may.mockClear();
    may.mockResolvedValue(true);
    expect(allowed(await run(null, requirePermission('clients.view', 'admin')))).toBe(false);
    expect(may).not.toHaveBeenCalled();
  });
});

describe('the error it reports', () => {
  it('names the role but not the permission key', async () => {
    may.mockResolvedValue(false);
    const err = await run('employee', requirePermission('invoices.view', 'admin')) as Error;
    expect(err.message).toContain('employee');
    // The key is internal: a refusal should not teach a caller the shape of
    // the permission scheme.
    expect(err.message).not.toContain('invoices.view');
  });
});
