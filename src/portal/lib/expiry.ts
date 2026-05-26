// Shared expiry logic for documents that carry an expiry date (visa / work
// authorization, passport, EAD, green card, etc.). 90-day window matches the
// existing visa-expiry segment (employeeSegments.VISA_EXPIRY_WINDOW_DAYS).
export const EXPIRY_WINDOW_DAYS = 90;

export type ExpiryStatus = 'expired' | 'expiring' | 'ok';

/** Returns 'expired' / 'expiring' (within window) / 'ok', or null if no/invalid date. */
export function expiryStatus(date?: string | null, windowDays = EXPIRY_WINDOW_DAYS): ExpiryStatus | null {
  if (!date) return null;
  const exp = new Date(date);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= windowDays) return 'expiring';
  return 'ok';
}

/** Whole days until expiry (negative if past). null if no/invalid date. */
export function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const exp = new Date(date);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
}
