import { Link } from 'react-router-dom';

interface PanelProps {
  /** Section title shown in the header. Omit to render a header-less surface. */
  title?: React.ReactNode;
  /** Small uppercase kicker above the title. */
  eyebrow?: string;
  /** Leading icon next to the title. */
  icon?: React.ReactNode;
  /** Right-aligned action — a route link ({ label, to }) or arbitrary node. */
  action?: { label: string; to: string } | React.ReactNode;
  /** Remove body padding (for tables / edge-to-edge content). */
  flush?: boolean;
  /** Extra classes on the outer panel. */
  className?: string;
  /** Extra classes on the body. */
  bodyClassName?: string;
  children: React.ReactNode;
}

function isLinkAction(a: PanelProps['action']): a is { label: string; to: string } {
  return !!a && typeof a === 'object' && 'to' in a && 'label' in a;
}

/**
 * Universal dashboard content surface (TypeUI "Dashboard" system, light theme).
 * Glass-like panel with an optional eyebrow + title header and a right-aligned
 * action. Replaces ad-hoc Card usage on dashboards for consistent hierarchy.
 */
export function Panel({
  title, eyebrow, icon, action, flush, className, bodyClassName, children,
}: PanelProps) {
  const hasHeader = title || eyebrow || action;
  return (
    <div className={`portal-panel ${className ?? ''}`}>
      {hasHeader && (
        <div className="portal-panel-head">
          <div className="min-w-0">
            {eyebrow && <p className="portal-eyebrow mb-1">{eyebrow}</p>}
            {title && (
              <div className="portal-panel-title">
                {icon}
                <span className="truncate">{title}</span>
              </div>
            )}
          </div>
          {isLinkAction(action) ? (
            <Link
              to={action.to}
              className="text-[12.5px] font-medium text-gray-500 hover:text-[#4069FF] transition-colors whitespace-nowrap inline-flex items-center gap-1"
            >
              {action.label} →
            </Link>
          ) : (
            action ?? null
          )}
        </div>
      )}
      <div className={`${flush ? 'portal-panel-body--flush' : 'portal-panel-body'} ${bodyClassName ?? ''}`}>
        {children}
      </div>
    </div>
  );
}
