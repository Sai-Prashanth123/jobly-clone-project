import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeFileName, uniqueObjectPath } from './objectPath';

afterEach(() => vi.useRealTimers());

describe('safeFileName', () => {
  it('strips path separators so a filename cannot escape its prefix', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeFileName('a/b\\c')).toBe('a_b_c');
  });

  it('keeps the characters that make a filename readable', () => {
    expect(safeFileName('Insurance-Waiver_Form.v2.pdf')).toBe('Insurance-Waiver_Form.v2.pdf');
  });

  it('caps the length, because an S3 key is bounded', () => {
    expect(safeFileName('a'.repeat(400))).toHaveLength(120);
  });

  it('handles an empty name without throwing', () => {
    expect(safeFileName('')).toBe('');
  });
});

describe('uniqueObjectPath', () => {
  // The actual production failure: the onboarding wizard uploads every staged
  // document in one Promise.all, so a dozen requests reach Lambda together.
  // With a key of `${id}/${Date.now()}-${name}` and `upsert: false`, two
  // uploads of the same filename in the same millisecond produced the same
  // key and S3 answered PreconditionFailed — a 500, and a document that was
  // never stored, while the wizard still showed the row as satisfied.
  it('does not collide when the clock does not move', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T17:46:12.402Z'));

    const keys = new Set<string>();
    for (let i = 0; i < 2000; i++) keys.add(uniqueObjectPath('emp-1', 'insurance-waiver-form.pdf'));

    expect(keys.size).toBe(2000);
  });

  it('would have collided under the old scheme — proving the test bites', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T17:46:12.402Z'));

    const oldScheme = (id: string, name: string) =>
      `${id}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) keys.add(oldScheme('emp-1', 'insurance-waiver-form.pdf'));

    expect(keys.size).toBe(1);
  });

  it('keeps the file under the prefix it was given', () => {
    const key = uniqueObjectPath('emp-1/dependents/dep-9', 'passport.pdf');
    expect(key.startsWith('emp-1/dependents/dep-9/')).toBe(true);
    expect(key.endsWith('-passport.pdf')).toBe(true);
  });

  it('cannot be escaped by a crafted filename', () => {
    const key = uniqueObjectPath('emp-1', '../../../private/other-employee/secret.pdf');
    expect(key.split('/')).toHaveLength(2); // prefix + one filename segment
    expect(key.startsWith('emp-1/')).toBe(true);
  });

  it('tolerates a trailing slash on the prefix', () => {
    expect(uniqueObjectPath('emp-1/', 'a.pdf').startsWith('emp-1/')).toBe(true);
    expect(uniqueObjectPath('emp-1/', 'a.pdf')).not.toContain('//');
  });

  it('still leads with the timestamp, so a bucket listing reads in date order', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T17:46:12.402Z'));
    const key = uniqueObjectPath('emp-1', 'a.pdf');
    expect(key).toContain(`/${Date.parse('2026-10-12T17:46:12.402Z')}-`);
  });
});
