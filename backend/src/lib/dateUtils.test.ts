import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  currentMondayUTC,
  isFutureWeekUTC,
  isBeyondFutureSubmitWindowUTC,
  dateAfterDaysUTC,
  FUTURE_SUBMIT_WINDOW_DAYS,
  isBeyondPastSubmitWindowUTC,
  dateBeforeDaysUTC,
  PAST_SUBMIT_WINDOW_DAYS,
} from './dateUtils';

/**
 * These helpers gate every timesheet submission and nothing covered them.
 *
 * The rule they encode has just changed: submission used to be refused for any
 * week past the current Monday, while the creation picker offered twelve weeks
 * ahead — so a timesheet could be built and then rejected at the one step that
 * mattered, which is what an employee reported. HR asked for 30 days.
 *
 * The boundary is the part worth pinning. Off-by-one here is invisible in
 * review and only shows up as somebody unable to file their hours.
 */

// A Wednesday, so the current Monday is two days back and the arithmetic is
// not accidentally right because the clock sits on a boundary.
const WEDNESDAY = '2026-10-14T09:30:00Z';
const THAT_MONDAY = '2026-10-12';

function freeze(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}
afterEach(() => vi.useRealTimers());

describe('currentMondayUTC', () => {
  it('finds the Monday of the current week', () => {
    freeze(WEDNESDAY);
    expect(currentMondayUTC()).toBe(THAT_MONDAY);
  });

  it('treats Sunday as belonging to the week that started six days earlier', () => {
    // The usual off-by-one: getUTCDay() is 0 on Sunday, so a naive 1 - day
    // jumps forward instead of back.
    freeze('2026-10-18T23:59:00Z'); // Sunday
    expect(currentMondayUTC()).toBe(THAT_MONDAY);
  });

  it('returns the day itself on a Monday', () => {
    freeze('2026-10-12T00:00:01Z');
    expect(currentMondayUTC()).toBe(THAT_MONDAY);
  });

  it('crosses a month boundary correctly', () => {
    freeze('2026-11-03T12:00:00Z'); // Tuesday
    expect(currentMondayUTC()).toBe('2026-11-02');
  });
});

describe('submission window', () => {
  it('is 30 days, as HR asked', () => {
    expect(FUTURE_SUBMIT_WINDOW_DAYS).toBe(30);
  });

  it('allows the current week', () => {
    freeze(WEDNESDAY);
    expect(isBeyondFutureSubmitWindowUTC(THAT_MONDAY)).toBe(false);
  });

  it('allows the week in the screenshot, which used to be refused', () => {
    // "This timesheet is for the week of 2026-10-19, which hasn't started yet"
    freeze(WEDNESDAY);
    expect(isFutureWeekUTC('2026-10-19')).toBe(true);          // still a future week
    expect(isBeyondFutureSubmitWindowUTC('2026-10-19')).toBe(false); // but now submittable
  });

  it('allows a week exactly on the boundary', () => {
    freeze(WEDNESDAY);
    const boundary = dateAfterDaysUTC(FUTURE_SUBMIT_WINDOW_DAYS);
    expect(boundary).toBe('2026-11-13');
    expect(isBeyondFutureSubmitWindowUTC(boundary)).toBe(false);
  });

  it('refuses the day after the boundary', () => {
    freeze(WEDNESDAY);
    expect(isBeyondFutureSubmitWindowUTC('2026-11-14')).toBe(true);
  });

  it('still refuses something far out', () => {
    freeze(WEDNESDAY);
    expect(isBeyondFutureSubmitWindowUTC('2027-03-01')).toBe(true);
  });

  it('never blocks a past week — that is a different rule', () => {
    freeze(WEDNESDAY);
    for (const past of ['2026-10-05', '2026-01-01', '2024-06-17']) {
      expect(isBeyondFutureSubmitWindowUTC(past), past).toBe(false);
    }
  });
});

describe('dateAfterDaysUTC', () => {
  it('counts forward in UTC across a month end', () => {
    freeze('2026-10-20T23:00:00Z');
    expect(dateAfterDaysUTC(30)).toBe('2026-11-19');
  });

  it('crosses a year boundary', () => {
    freeze('2026-12-20T00:00:00Z');
    expect(dateAfterDaysUTC(30)).toBe('2027-01-19');
  });

  it('handles a leap day', () => {
    freeze('2028-02-01T00:00:00Z');
    expect(dateAfterDaysUTC(29)).toBe('2028-03-01'); // 2028 is a leap year
  });

  // Late-evening UTC is where a local-time implementation would drift a day.
  it('does not drift when the clock is near midnight', () => {
    freeze('2026-10-20T23:59:59Z');
    expect(dateAfterDaysUTC(1)).toBe('2026-10-21');
  });
});

/**
 * "Previous week timesheet fillup — for month back."
 *
 * There was no past bound at all beyond the hire date, so this NARROWS what
 * an employee may do, and only an employee: admin and HR keep the full range
 * because correcting an old timesheet is their job.
 */
describe('how far back a timesheet may be filled', () => {
  it('allows a week from a fortnight ago', () => {
    expect(isBeyondPastSubmitWindowUTC(dateBeforeDaysUTC(14))).toBe(false);
  });

  // Inclusive at the boundary, matching the future window — "up to a month
  // back" reads that way to whoever asked for it.
  it('allows a week starting exactly at the boundary', () => {
    expect(isBeyondPastSubmitWindowUTC(dateBeforeDaysUTC(PAST_SUBMIT_WINDOW_DAYS))).toBe(false);
  });

  it('refuses the day beyond it', () => {
    expect(isBeyondPastSubmitWindowUTC(dateBeforeDaysUTC(PAST_SUBMIT_WINDOW_DAYS + 1))).toBe(true);
  });

  it('refuses a week from last year', () => {
    expect(isBeyondPastSubmitWindowUTC(dateBeforeDaysUTC(365))).toBe(true);
  });

  it('never refuses this week or a future one', () => {
    expect(isBeyondPastSubmitWindowUTC(dateAfterDaysUTC(0))).toBe(false);
    expect(isBeyondPastSubmitWindowUTC(dateAfterDaysUTC(7))).toBe(false);
  });

  it('is a month, not a week', () => {
    expect(PAST_SUBMIT_WINDOW_DAYS).toBe(31);
  });

  // The two windows are independent: narrowing the past must not have moved
  // the future one, which HR asked for separately.
  it('leaves the future window alone', () => {
    expect(FUTURE_SUBMIT_WINDOW_DAYS).toBe(30);
    expect(isBeyondFutureSubmitWindowUTC(dateAfterDaysUTC(30))).toBe(false);
    expect(isBeyondFutureSubmitWindowUTC(dateAfterDaysUTC(31))).toBe(true);
  });
});
