import type { Employee } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const VISA_EXPIRY_WINDOW_DAYS = 90;

export function isActive(e: Employee): boolean {
  return e.status === 'active';
}

export function isOnboarding(e: Employee): boolean {
  return e.status === 'onboarding';
}

export function isInactive(e: Employee): boolean {
  return e.status === 'inactive';
}

export function isVisaExpiringSoon(e: Employee, days = VISA_EXPIRY_WINDOW_DAYS): boolean {
  if (!e.visaExpiry) return false;
  const exp = new Date(e.visaExpiry);
  if (Number.isNaN(exp.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const limit = new Date(today.getTime() + days * MS_PER_DAY);
  return exp >= today && exp <= limit;
}

export function daysUntilVisaExpiry(e: Employee): number | null {
  if (!e.visaExpiry) return null;
  const exp = new Date(e.visaExpiry);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / MS_PER_DAY);
}

export function isI9Issue(e: Employee): boolean {
  return e.i9Status === 'pending' || e.i9Status === 'expired';
}
