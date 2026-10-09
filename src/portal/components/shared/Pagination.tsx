import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Numbered pagination.
 *
 * Previously every paginated view showed only "Page 3 of 12" with arrows, so
 * reaching page 9 meant six clicks. This renders the page numbers themselves.
 *
 * One component rather than three: DataTable, AuditLog and AdminSettings each
 * had their own arrows-only block, and the portal has a long history of the
 * same rule being written in several places and then drifting apart.
 */

/**
 * Page numbers to render, with `null` marking a gap.
 *
 * Always keeps the first and last page reachable in one click, plus a window
 * around the current page, so the control never grows past ~7 slots no matter
 * how many pages there are:
 *
 *     1 … 4 [5] 6 … 20
 *
 * `windowSize` is how many pages sit either side of the current one — 1 on
 * phones where there is no room, 2 from sm up.
 */
export function pageItems(current: number, total: number, windowSize = 1): (number | null)[] {
  if (total <= 1) return [1];
  const pages = new Set<number>([1, total]);
  for (let p = current - windowSize; p <= current + windowSize; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    // A gap of exactly one page is rendered as that page, not an ellipsis —
    // "1 … 3" wastes the same space as "1 2 3" while hiding a destination.
    if (prev && p - prev === 2) out.push(prev + 1);
    else if (prev && p - prev > 2) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** e.g. "Showing 1–25 of 240" — rendered on the left when provided. */
  summary?: React.ReactNode;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, summary, className }: PaginationProps) {
  if (totalPages <= 1) return summary ? <div className={className}>{summary}</div> : null;

  const go = (p: number) => onPageChange(Math.min(totalPages, Math.max(1, p)));

  const numbers = (items: (number | null)[], hiddenBelowSm: boolean) => items.map((p, i) =>
    p === null ? (
      <span key={`gap-${i}`} aria-hidden className="px-1 text-gray-400 select-none">…</span>
    ) : (
      <Button
        key={p}
        variant={p === page ? 'default' : 'outline'}
        size="sm"
        aria-label={`Page ${p}`}
        aria-current={p === page ? 'page' : undefined}
        onClick={() => go(p)}
        className={`h-8 min-w-8 px-2 tabular-nums ${hiddenBelowSm ? 'hidden sm:inline-flex' : ''}`}
      >
        {p}
      </Button>
    ),
  );

  return (
    <div className={className ?? 'flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600'}>
      {summary && <span className="text-xs sm:text-sm">{summary}</span>}

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="outline" size="sm" aria-label="Previous page"
          disabled={page === 1} onClick={() => go(page - 1)}
          className="h-8 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Two windows: a tight one for phones, a wider one from sm up. Both are
            rendered and swapped with CSS rather than measuring the viewport,
            so there is no layout flash on first paint. */}
        <span className="flex items-center gap-1 sm:hidden">{numbers(pageItems(page, totalPages, 0), false)}</span>
        <span className="hidden sm:flex items-center gap-1">{numbers(pageItems(page, totalPages, 2), false)}</span>

        <Button
          variant="outline" size="sm" aria-label="Next page"
          disabled={page === totalPages} onClick={() => go(page + 1)}
          className="h-8 px-2"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
