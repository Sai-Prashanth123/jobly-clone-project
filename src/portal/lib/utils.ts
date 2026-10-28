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

/**
 * The one upload limit, mirroring MAX_UPLOAD_BYTES in
 * backend/src/lib/storage/uploadLimits.ts. uploadLimits.parity.test.ts fails if
 * the two drift apart.
 *
 * 100 MB is now a real number. It used to say 20 MB while the infrastructure
 * refused anything over about 4.5 MB, because uploads passed through Lambda;
 * they now go straight to storage (see lib/uploadDocument.ts).
 */
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

/**
 * The limit as a person reads it. EVERY piece of user-facing copy derives from
 * this — the old number was retyped on six screens, so raising it once left
 * five of them lying. uploadLimits.parity.test.ts fails on a hard-typed size.
 */
export const MAX_DOCUMENT_SIZE_LABEL = `${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB`;

/**
 * Returns an error message if the file should be rejected, or null if it's fine.
 *
 * Size only. There is no longer a type whitelist: people onboard with whatever
 * their university or attorney sent them, and a rejected .pages or .zip meant
 * an email to HR instead. Safety moved to how files are SERVED rather than
 * what may be stored — see backend contentType.ts and the attachment-by-default
 * download URLs.
 *
 * Kept as a function even though it now checks one thing, so all ~12 call sites
 * stay unchanged and the next rule has somewhere to live.
 */
export function validateUploadFile(file: File, maxBytes = MAX_DOCUMENT_BYTES): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > maxBytes) {
    return `${file.name} is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}

/**
 * Identity & Documents uploads (the onboarding wizard's section 07).
 *
 * Empty, so the file picker shows everything. It used to list
 * '.pdf,.jpg,.jpeg,.png,.doc,.docx', which twice drifted from the backend's own
 * list and blocked Word documents — and an `accept` attribute is only a picker
 * HINT anyway: it never stopped drag-and-drop or "All Files" in the OS dialog,
 * so it was never the thing enforcing anything.
 *
 * Kept as a named export so the six inputs that spread it stay unchanged.
 */
export const IDENTITY_DOC_ACCEPT = '';

/** Returns an error message if the file should be rejected, or null if it's fine. */
export function validateIdentityDocFile(file: File): string | null {
  return validateUploadFile(file);
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

/**
 * Join address parts into one readable line, skipping the blanks.
 *
 * Added because the emergency-contact card rendered ONLY the street and
 * silently dropped city, state and zip — employees filled them in and HR
 * could not see them. The same card in the legal view composed the full
 * address correctly, and the present-address block three hundred lines up in
 * the same file did too; the emergency block was simply an older copy that
 * never caught up. One function so the next field added shows up everywhere.
 */
export function formatAddress(
  ...parts: (string | null | undefined)[]
): string {
  return parts.map(p => (p ?? '').trim()).filter(Boolean).join(', ');
}
