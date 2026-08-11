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

/** Format a YYYY-MM-DD date as MM/DD/YYYY — used for per-day timesheet date lists. */
export function formatDateUS(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'MM/dd/yyyy');
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

// Masks an SSN down to its last 4 digits, regardless of how it's stored
// (with dashes, without, or partial). String.replace() on a non-matching
// pattern silently returns the input UNCHANGED (not falsy), so a naive
// `str.replace(/^(\d{3})-(\d{2})-(\d{4})$/, ...) || fallback` chain never
// reaches its fallback for any non-standard format — it just displays the
// raw, unmasked value. Always deriving the mask from the digits themselves
// avoids that failure mode entirely.
// Digits-only, capped at 10, live-formatted as a US phone number as the user
// types — e.g. "5551234567" -> "(555) 123-4567".
export function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Digits-only, capped at 9, live-formatted as a US ZIP code as the user
// types — e.g. "946011234" -> "94601-1234". A plain 5-digit ZIP passes
// through unchanged.
export function formatZip(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// Mirrors backend ALLOWED_MIME_TYPES (backend/src/middleware/upload.ts) for
// instant client-side feedback — the accept="..." attribute on a file input
// is only a picker *hint*; it does not stop drag-and-drop or "All Files" in
// the OS dialog, so every upload needs this check in its onChange too.
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Returns an error message if the file should be rejected, or null if it's fine. */
export function validateUploadFile(file: File, maxBytes = MAX_DOCUMENT_BYTES): string | null {
  if (file.size > maxBytes) return `${file.name} is larger than ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) return `${file.name}: that file type isn't allowed.`;
  return null;
}

export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : (digits || ssn.slice(-4));
  return `***-**-${last4}`;
}

// Guards against TanStack Query firing /api/.../undefined when useParams returns
// the literal string "undefined" (which is truthy) or an empty string.
export function isValidId(id: string | undefined | null): id is string {
  return typeof id === 'string' && id.length > 0 && id !== 'undefined' && id !== 'null';
}

// Parses a numeric <input value> safely. Returns undefined for empty / NaN so
// callers can show a validation error instead of silently saving 0.
export function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

// Resolve a document-level invoice discount to a dollar amount applied to the
// subtotal (Wave's "Add a discount", applied BEFORE tax). MUST stay byte-identical
// to the backend's computeDiscountAmount in invoices.service.ts (same formula,
// rounding, clamping) so the on-screen total matches the persisted total.
export function computeDiscount(
  subtotal: number,
  discountType?: 'percentage' | 'fixed' | null,
  discountValue?: number | null,
): number {
  if (!discountType || !discountValue || discountValue <= 0 || subtotal <= 0) return 0;
  const raw = discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue;
  return Math.round(Math.min(Math.max(raw, 0), subtotal) * 100) / 100;
}
