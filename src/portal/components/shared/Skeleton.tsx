import { cn } from '@/lib/utils';

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search bar skeleton */}
      <div className="flex gap-3">
        <SkeletonBox className="h-9 flex-1 max-w-sm" />
        <SkeletonBox className="h-9 w-36" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-md border bg-white overflow-hidden">
        {/* Header */}
        <div className="grid gap-4 px-4 py-3 bg-gray-50 border-b" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonBox key={i} className="h-4" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 px-4 py-3.5 border-b last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBox key={c} className={`h-4 ${c === 0 ? 'w-24' : c === cols - 1 ? 'w-16' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SkeletonBox className="h-8 w-16" />
        <SkeletonBox className="h-7 w-48" />
        <SkeletonBox className="h-5 w-20" />
      </div>
      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4 space-y-2">
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-6 w-28" />
          </div>
        ))}
      </div>
      {/* Main card */}
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <SkeletonBox className="h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <SkeletonBox className="h-10 flex-1" />
              <SkeletonBox className="h-10 flex-1" />
              <SkeletonBox className="h-10 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 ${count === 4 ? 'lg:grid-cols-4' : count === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <SkeletonBox className="h-3 w-24" />
              <SkeletonBox className="h-7 w-16" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-11 w-11 rounded-2xl flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
