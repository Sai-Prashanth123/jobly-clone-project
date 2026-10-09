import { describe, it, expect } from 'vitest';
import { pageItems } from './Pagination';

// `null` is a gap (rendered as an ellipsis).
const show = (xs: (number | null)[]) => xs.map(x => x ?? '…').join(' ');

describe('pageItems', () => {
  it('lists every page when they all fit', () => {
    expect(show(pageItems(1, 5, 2))).toBe('1 2 3 4 5');
    expect(show(pageItems(3, 5, 2))).toBe('1 2 3 4 5');
  });

  it('keeps the first and last page reachable in one click', () => {
    const items = pageItems(10, 20, 2);
    expect(items[0]).toBe(1);
    expect(items[items.length - 1]).toBe(20);
  });

  it('collapses long runs into a single gap', () => {
    expect(show(pageItems(10, 20, 2))).toBe('1 … 8 9 10 11 12 … 20');
  });

  it('never grows past a predictable width', () => {
    // 2 either side + current + first + last + two gaps.
    for (const total of [20, 100, 5000]) {
      expect(pageItems(Math.floor(total / 2), total, 2).length).toBeLessThanOrEqual(9);
    }
  });

  // A gap of exactly one page would hide a destination for no space saving.
  it('shows the single page rather than an ellipsis for a one-page gap', () => {
    expect(show(pageItems(4, 7, 1))).toBe('1 2 3 4 5 6 7');
    // 1,2,3,4 then 6 leaves a one-page hole, so page 5 is shown rather than
    // an ellipsis that would occupy the same width and hide a destination.
    expect(show(pageItems(3, 6, 1))).toBe('1 2 3 4 5 6');
    // A two-page hole does collapse.
    expect(show(pageItems(3, 8, 1))).toBe('1 2 3 4 … 8');
  });

  it('handles the narrow phone window', () => {
    expect(show(pageItems(10, 20, 0))).toBe('1 … 10 … 20');
    expect(show(pageItems(1, 20, 0))).toBe('1 … 20');
  });

  it('copes with the edges', () => {
    expect(show(pageItems(1, 1, 2))).toBe('1');
    expect(show(pageItems(1, 0, 2))).toBe('1');
    expect(show(pageItems(1, 2, 2))).toBe('1 2');
    expect(show(pageItems(20, 20, 2))).toBe('1 … 18 19 20');
  });

  it('never emits a duplicate or an out-of-range page', () => {
    for (const [cur, total] of [[1, 30], [15, 30], [30, 30], [2, 3]]) {
      const nums = pageItems(cur, total, 2).filter((x): x is number => x !== null);
      expect(new Set(nums).size).toBe(nums.length);
      expect(nums.every(n => n >= 1 && n <= total)).toBe(true);
      expect([...nums]).toEqual([...nums].sort((a, b) => a - b));
    }
  });
});
