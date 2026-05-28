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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6 pb-5 border-b border-slate-100">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="display-lg text-ink-900 truncate">{title}</h1>
          {description && (
            <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
