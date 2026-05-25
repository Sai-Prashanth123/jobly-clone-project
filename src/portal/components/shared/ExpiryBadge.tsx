import { AlertTriangle } from 'lucide-react';
import { expiryStatus, daysUntil } from '../../lib/expiry';

/**
 * Red "Expired" / amber "Expiring soon" pill for a document expiry date.
 * Renders nothing when the date is missing or comfortably in the future.
 */
export function ExpiryBadge({ date, className = '' }: { date?: string | null; className?: string }) {
  const status = expiryStatus(date);
  if (!status || status === 'ok') return null;
  const expired = status === 'expired';
  const d = daysUntil(date);
  const text = expired
    ? 'Expired'
    : `Expiring${d != null ? ` in ${d}d` : ' soon'}`;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
        expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      } ${className}`}
    >
      <AlertTriangle className="h-3 w-3" /> {text}
    </span>
  );
}
