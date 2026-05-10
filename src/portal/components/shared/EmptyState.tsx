import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title = 'No records found',
  description = 'Get started by creating a new record.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 blur-md opacity-60" />
        <div className="relative p-5 rounded-full bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-[var(--shadow-sm)]">
          {icon ?? <Inbox className="h-10 w-10 text-gray-300" strokeWidth={1.5} />}
        </div>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
