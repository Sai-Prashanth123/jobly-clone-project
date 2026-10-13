import { describe, it, expect } from 'vitest';
import { canSeeSensitiveDocs } from './docVisibility';

/**
 * HR (Oct 2026): "I9, I94, I-140, LCA, 797, Visa, DL, Education to be visible
 * only for Manager" — confirmed as admin + operations (shown as Project
 * Manager).
 *
 * Worth pinning because this *removes* access two roles had yesterday, and a
 * widened set would be invisible in review: nothing breaks when a guard lets
 * too many people through.
 */
describe('who may see immigration and education paperwork', () => {
  it('lets admin and Project Manager through', () => {
    expect(canSeeSensitiveDocs('admin')).toBe(true);
    expect(canSeeSensitiveDocs('operations')).toBe(true);
  });

  it('keeps HR, Finance, Legal and employees out', () => {
    for (const role of ['hr', 'finance', 'legal', 'employee']) {
      expect(canSeeSensitiveDocs(role), `${role} should not see these`).toBe(false);
    }
  });

  it('refuses an absent or unknown role rather than defaulting open', () => {
    expect(canSeeSensitiveDocs(undefined)).toBe(false);
    expect(canSeeSensitiveDocs(null)).toBe(false);
    expect(canSeeSensitiveDocs('')).toBe(false);
    expect(canSeeSensitiveDocs('superuser')).toBe(false);
  });
});
