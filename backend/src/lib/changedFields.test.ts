import { describe, it, expect } from 'vitest';

// Mirrors the change detection in updateEmployee (services/employees.service).
//
// The audit log reached 1,941 rows that all read "updated / Employee /
// EMP-0143 / —", because updateEmployee logged on EVERY PUT regardless of
// whether anything changed, with no detail. The onboarding wizard autosaves as
// the employee types, so one sitting produced a row a minute and the real
// events were buried.
//
// What matters is that a no-op save records nothing, so these pin the
// comparison rules rather than the logging call itself.
const toSnake = (k: string) => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());

function changedFields(
  existing: Record<string, unknown>,
  input: Record<string, unknown>,
): string[] {
  return Object.keys(input).filter(key => {
    const before = existing[toSnake(key)];
    const after = input[key];
    if (after === undefined) return false;
    if (before === null && after === '') return false;
    if (typeof after === 'object' && after !== null) {
      return JSON.stringify(before ?? null) !== JSON.stringify(after);
    }
    return String(before ?? '') !== String(after ?? '');
  });
}

describe('updateEmployee change detection', () => {
  // The actual regression: the wizard re-submitting the same data.
  it('reports nothing when an autosave re-sends identical values', () => {
    const existing = { first_name: 'Ashok', last_name: 'Chundru', phone: '(555) 123-4567' };
    const input = { firstName: 'Ashok', lastName: 'Chundru', phone: '(555) 123-4567' };
    expect(changedFields(existing, input)).toEqual([]);
  });

  it('names the field that actually changed', () => {
    const existing = { first_name: 'Ashok', phone: '(555) 123-4567' };
    expect(changedFields(existing, { firstName: 'Ashok', phone: '(555) 999-0000' }))
      .toEqual(['phone']);
  });

  it('maps camelCase input onto snake_case columns', () => {
    // Getting this wrong would make every field look changed, which is the
    // same flood in a different costume.
    const existing = { work_email: 'a@b.com', linkedin_url: 'x' };
    expect(changedFields(existing, { workEmail: 'a@b.com', linkedinUrl: 'x' })).toEqual([]);
    expect(changedFields(existing, { workEmail: 'c@d.com', linkedinUrl: 'x' })).toEqual(['workEmail']);
  });

  it('treats null-to-empty-string as unchanged', () => {
    // An untouched optional field arrives as '' from the form but is null in
    // the column; counting that as a change would log on every save.
    expect(changedFields({ middle_name: null }, { middleName: '' })).toEqual([]);
  });

  it('does see a value being cleared', () => {
    expect(changedFields({ middle_name: 'Kumar' }, { middleName: '' })).toEqual(['middleName']);
  });

  it('compares objects and arrays by value, not reference', () => {
    const existing = {
      address: { street: '12 Oak', city: 'Edison' },
      education: [{ level: 'BSc' }],
    };
    expect(changedFields(existing, {
      address: { street: '12 Oak', city: 'Edison' },
      education: [{ level: 'BSc' }],
    })).toEqual([]);

    expect(changedFields(existing, {
      address: { street: '12 Oak', city: 'Newark' },
      education: [{ level: 'BSc' }],
    })).toEqual(['address']);
  });

  it('ignores keys the caller did not send', () => {
    expect(changedFields({ first_name: 'A' }, { firstName: undefined, lastName: 'B' }))
      .toEqual(['lastName']);
  });

  it('does not trip over numbers arriving as strings', () => {
    // The pgrest shim returns numeric as a number; a form sends a string.
    expect(changedFields({ pay_rate: 50 }, { payRate: '50' })).toEqual([]);
    expect(changedFields({ pay_rate: 50 }, { payRate: '60' })).toEqual(['payRate']);
  });
});
