import { describe, it, expect } from 'vitest';
import {
  MAX_ALERT_INTERVAL_DAYS, alertIntervalDays, shouldAlert, docAlertKey,
  parseDocAlertKey, expiryUrgency, describeExpiry, daysBetween,
} from './expiryAlerts';

describe('alert cadence', () => {
  it('nags weekly about something already expired', () => {
    expect(alertIntervalDays(-1)).toBe(7);
    expect(alertIntervalDays(-400)).toBe(7);
  });

  it('alerts daily in the final week', () => {
    expect(alertIntervalDays(0)).toBe(1);
    expect(alertIntervalDays(7)).toBe(1);
  });

  it('alerts weekly inside a month and monthly beyond it', () => {
    expect(alertIntervalDays(8)).toBe(7);
    expect(alertIntervalDays(30)).toBe(7);
    expect(alertIntervalDays(31)).toBe(30);
    expect(alertIntervalDays(90)).toBe(30);
  });

  // The lookback window for the "when did we last alert" query is sized from
  // this. If an interval ever exceeds it, the query would miss the previous
  // alert, every document would look never-alerted, and the nightly flood
  // would come straight back with nothing failing to show it.
  it('never exceeds the lookback window the query uses', () => {
    for (const d of [-500, -1, 0, 1, 7, 8, 14, 29, 30, 31, 60, 90, 365]) {
      expect(alertIntervalDays(d), `interval for ${d} days left`)
        .toBeLessThanOrEqual(MAX_ALERT_INTERVAL_DAYS);
    }
  });

  it('always alerts the first time', () => {
    expect(shouldAlert(90, null)).toBe(true);
    expect(shouldAlert(-30, null)).toBe(true);
  });

  it('holds off until the interval has passed', () => {
    expect(shouldAlert(90, 0)).toBe(false);   // alerted today, 90 days out
    expect(shouldAlert(90, 29)).toBe(false);
    expect(shouldAlert(90, 30)).toBe(true);
    expect(shouldAlert(20, 6)).toBe(false);
    expect(shouldAlert(20, 7)).toBe(true);
    expect(shouldAlert(3, 0)).toBe(false);    // already told them today
    expect(shouldAlert(3, 1)).toBe(true);     // but tell them again tomorrow
  });

  // This is the whole point of the change: 90 nights x every admin and HR
  // user, per document, became unreadable.
  it('cuts a 90-day runway from 91 alerts to 14', () => {
    let lastSent: number | null = null;
    const firedAt: number[] = [];
    for (let day = 0; day <= 90; day++) {
      const daysLeft = 90 - day;
      const since = lastSent === null ? null : day - lastSent;
      if (shouldAlert(daysLeft, since)) {
        firedAt.push(daysLeft);
        lastSent = day;
      }
    }
    // Monthly while it is far off, weekly inside a month, then every day of
    // the final week — which is the week where it actually matters.
    expect(firedAt).toEqual([90, 60, 30, 23, 16, 9, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('keeps alerting a lapsed document rather than giving up', () => {
    let lastSent: number | null = null;
    let alerts = 0;
    for (let day = 0; day < 28; day++) {
      const since = lastSent === null ? null : day - lastSent;
      if (shouldAlert(-day - 1, since)) { alerts++; lastSent = day; }
    }
    expect(alerts).toBe(4); // four weeks, four alerts
  });
});

// The writer and the reader of this key live in the same module precisely so
// this test can prove they agree. If they drift, deduplication silently stops
// working and nothing else fails.
describe('dedupe key round trip', () => {
  const cases: [string, string][] = [
    ['Passport', '2027-03-01'],
    ['Visa / Work Authorization', '2026-12-31'],
    ['Employment Authorization Document', '2026-10-01'],
    ['I-20', '2028-05-15'],
    ["Driver's License", '2029-01-09'],
  ];

  it('survives the HR message shape', () => {
    for (const [type, expiry] of cases) {
      const key = docAlertKey(type, expiry);
      const message = `Asha Rao (EMP-0007): ${key} — expires in 47 days.`;
      expect(parseDocAlertKey(message), `HR message for ${type}`).toBe(key);
    }
  });

  it('survives the employee message shape', () => {
    for (const [type, expiry] of cases) {
      const key = docAlertKey(type, expiry);
      const message = `Your ${key} — expires in 47 days. Please renew it and upload the updated copy.`;
      expect(parseDocAlertKey(message), `employee message for ${type}`).toBe(key);
    }
  });

  it('survives the expired wording too', () => {
    const key = docAlertKey('Passport', '2024-01-01');
    expect(parseDocAlertKey(`Asha Rao (EMP-0007): ${key} — expired 12 days ago.`)).toBe(key);
    expect(parseDocAlertKey(`Your ${key} — expired 12 days ago. Please renew it and upload the updated copy.`)).toBe(key);
  });

  // A renewal must read as a different document, or the new expiry date would
  // inherit the old one's cadence and go unreported for up to a month.
  it('treats a renewed document as a new one', () => {
    expect(docAlertKey('Passport', '2027-03-01')).not.toBe(docAlertKey('Passport', '2037-03-01'));
  });

  it('returns null for a message it did not write', () => {
    expect(parseDocAlertKey('Timesheet TS-0042 was approved.')).toBeNull();
    expect(parseDocAlertKey('')).toBeNull();
  });
});

describe('wording and severity', () => {
  it('describes lapsed, today and future dates', () => {
    expect(describeExpiry(-1)).toBe('expired 1 day ago');
    expect(describeExpiry(-12)).toBe('expired 12 days ago');
    expect(describeExpiry(0)).toBe('expires today');
    expect(describeExpiry(1)).toBe('expires in 1 day');
    expect(describeExpiry(47)).toBe('expires in 47 days');
  });

  it('treats expired as the most severe', () => {
    expect(expiryUrgency(-1)).toBe('error');
    expect(expiryUrgency(14)).toBe('error');
    expect(expiryUrgency(15)).toBe('warning');
    expect(expiryUrgency(30)).toBe('warning');
    expect(expiryUrgency(31)).toBe('info');
  });

  it('floors whole days between two instants', () => {
    const then = new Date('2026-10-01T23:00:00Z');
    expect(daysBetween(then, new Date('2026-10-02T22:00:00Z'))).toBe(0);
    expect(daysBetween(then, new Date('2026-10-02T23:00:00Z'))).toBe(1);
    expect(daysBetween(then, new Date('2026-10-08T23:00:00Z'))).toBe(7);
  });
});
