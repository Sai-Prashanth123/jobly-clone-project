import { addDays as dfnsAddDays, format, parseISO } from 'date-fns';

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d, yyyy');
  } catch {
    return date;
  }
}

export function formatDateTime(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MMM d, yyyy h:mm a');
  } catch {
    return date ?? '—';
  }
}

export function addDays(dateStr: string, days: number): string {
  try {
    return dfnsAddDays(parseISO(dateStr), days).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export function getMondayOfWeek(date: Date): Date {
  // Use UTC day-of-week so the result is consistent across all client timezones
  const utcDay = date.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysToMonday));
}

export function getWeekDates(mondayStr: string): string[] {
  const monday = parseISO(mondayStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = dfnsAddDays(monday, i);
    return d.toISOString().split('T')[0];
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
