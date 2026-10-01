import { describe, it, expect } from 'vitest';
import { createEmployeeSchema } from './employee.schema';

// Phone and ZIP had no server-side validation at all — the wizard formats them
// as you type and the API stored whatever arrived.
//
// This test exists because adding that validation is itself risky: the
// onboarding wizard autosaves while the employee is still typing, so a rule
// that is even slightly too strict turns an autosave into a 400 and recreates
// the "internal server error when I save" bug this audit is clearing up. An
// earlier version of these regexes lost its backslashes in editing and became
// /^[+ds().-]$/ — accepting the letters d and s while rejecting every digit,
// which would have failed every real phone number. Hence the explicit cases.
const parse = (patch: Record<string, unknown>) =>
  createEmployeeSchema.safeParse({
    firstName: 'A', lastName: 'B', email: 'a@b.com', ...patch,
  });

describe('employee phone validation', () => {
  it.each([
    '(555) 123-4567',   // exactly what formatUsPhone produces
    '555-123-4567',
    '5551234567',
    '+1 555 123 4567',  // international
    '+91 98765 43210',
    '(555) 123-4567 x12'.replace(' x12', ''), // no extension support needed
    '(555',             // mid-typing, autosaved
    '5',
    '',                 // cleared field
  ])('accepts %j', (phone) => {
    expect(parse({ phone }).success, `rejected ${JSON.stringify(phone)}`).toBe(true);
  });

  it.each(['abc', 'call me', '555-CALL-NOW', '<script>'])('rejects %j', (phone) => {
    expect(parse({ phone }).success).toBe(false);
  });
});

describe('employee ZIP validation', () => {
  const withZip = (zip: string) => parse({ address: { street: '', city: '', state: '', zip, country: 'US' } });

  it.each([
    '94601',        // 5-digit
    '94601-1234',   // exactly what formatZip produces for 9 digits
    '946011234',    // pasted without the dash
    'K1A 0B1',      // Canadian — these records have a country field
    'SW1A 1AA',     // UK
    '9',            // mid-typing, autosaved
    '',
  ])('accepts %j', (zip) => {
    expect(withZip(zip).success, `rejected ${JSON.stringify(zip)}`).toBe(true);
  });

  it.each(['!!!', '946/01', '94601;drop', '<x>'])('rejects %j', (zip) => {
    expect(withZip(zip).success).toBe(false);
  });
});
