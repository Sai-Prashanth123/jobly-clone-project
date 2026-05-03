interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional eyebrow label rendered above the title (e.g. section name). */
  eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 portal-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6 pb-4 border-b border-gray-100">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1.5">
              {eyebrow}
            </p>
          )}
          <h1 className="portal-heading text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-gray-500 mt-1.5">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
