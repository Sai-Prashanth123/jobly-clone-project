import { describe, it, expect } from 'vitest';

/**
 * The grouping and ordering the permissions matrix renders.
 *
 * Mirrored here rather than imported from the component, which needs a query
 * client and a server. What is worth pinning is the shape of the screen: 127
 * permissions across ~35 areas is only usable if the grouping is stable and
 * the built-in roles stay in their familiar order — a matrix whose columns
 * move between loads is one nobody can read a row off.
 */

const ROLE_ORDER = ['admin', 'hr', 'operations', 'finance', 'legal', 'employee'];

function sortRoles<T extends { key: string }>(roles: T[]): T[] {
  return [...roles].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.key), bi = ROLE_ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.key.localeCompare(b.key);
  });
}

function group<T extends { group_name: string }>(perms: T[]): [string, T[]][] {
  const by = new Map<string, T[]>();
  for (const p of perms) {
    if (!by.has(p.group_name)) by.set(p.group_name, []);
    by.get(p.group_name)!.push(p);
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

describe('role columns', () => {
  it('keeps the built-ins in their familiar order whatever the server sends', () => {
    const shuffled = [{ key: 'employee' }, { key: 'finance' }, { key: 'admin' }, { key: 'legal' }, { key: 'hr' }, { key: 'operations' }];
    expect(sortRoles(shuffled).map(r => r.key)).toEqual(ROLE_ORDER);
  });

  // A custom role must not displace a built-in column people are used to.
  it('puts custom roles after the built-ins', () => {
    const withCustom = [{ key: 'regional_manager' }, { key: 'admin' }, { key: 'auditor' }, { key: 'hr' }];
    expect(sortRoles(withCustom).map(r => r.key)).toEqual(['admin', 'hr', 'auditor', 'regional_manager']);
  });

  it('is stable — sorting twice changes nothing', () => {
    const once = sortRoles([{ key: 'hr' }, { key: 'admin' }, { key: 'zeta' }]);
    expect(sortRoles(once)).toEqual(once);
  });
});

describe('permission groups', () => {
  const PERMS = [
    { key: 'invoices.view', group_name: 'Invoices' },
    { key: 'employees.view', group_name: 'Employees' },
    { key: 'employees.create', group_name: 'Employees' },
    { key: 'invoices.manage', group_name: 'Invoices' },
    { key: 'assets.view', group_name: 'Assets' },
  ];

  it('groups by area, alphabetically', () => {
    expect(group(PERMS).map(([g]) => g)).toEqual(['Assets', 'Employees', 'Invoices']);
  });

  it('keeps every permission — none is lost in the grouping', () => {
    const total = group(PERMS).reduce((n, [, ps]) => n + ps.length, 0);
    expect(total).toBe(PERMS.length);
  });

  it('survives an empty list', () => {
    expect(group([])).toEqual([]);
  });
});
