import { describe, it, expect } from 'vitest';
import { generateTempPassword, TEMP_PASSWORD_LENGTH } from './tempPassword';

// The bug this replaces: 'Jobly@' + Math.random().toString(36).slice(2,8)
// .toUpperCase() produced a password with no digit ~14% of the time, because
// each base-36 character is a digit only 10 times in 36. Cognito's
// RequireNumbers rejected those with InvalidPasswordException, so roughly one
// in seven employee creations and password resets died with a 500.
const SAMPLES = 5000;

describe('generateTempPassword', () => {
  it('always satisfies the pool policy', () => {
    const offenders: string[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const p = generateTempPassword();
      if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p)) offenders.push(p);
    }
    // Name one, so a failure is diagnosable rather than just a count.
    expect(offenders.slice(0, 3)).toEqual([]);
  });

  it('stays inside the 8-12 length range', () => {
    const lengths = new Set<number>();
    for (let i = 0; i < SAMPLES; i++) lengths.add(generateTempPassword().length);
    expect([...lengths]).toEqual([TEMP_PASSWORD_LENGTH]);
    expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
    expect(TEMP_PASSWORD_LENGTH).toBeLessThanOrEqual(12);
  });

  it('honours an explicit length', () => {
    expect(generateTempPassword(8)).toHaveLength(8);
    expect(generateTempPassword(12)).toHaveLength(12);
    // Even at the minimum there is room for all three required classes.
    expect(/[A-Z]/.test(generateTempPassword(8))).toBe(true);
  });

  it('does not put the guaranteed characters in fixed positions', () => {
    // Without the shuffle, index 0 would always be the uppercase pick and
    // index 2 always the digit.
    const firstChars = new Set<string>();
    const thirdIsDigit = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      firstChars.add(p[0]);
      thirdIsDigit.add(/[0-9]/.test(p[2]));
    }
    expect(firstChars.size).toBeGreaterThan(5);
    expect(thirdIsDigit.size).toBe(2); // sometimes a digit, sometimes not
  });

  it('avoids characters people misread when copying from an email', () => {
    for (let i = 0; i < SAMPLES; i++) {
      expect(generateTempPassword()).not.toMatch(/[O0Il1]/);
    }
  });

  it('does not repeat itself', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateTempPassword());
    expect(seen.size).toBe(1000);
  });
});
