import { Activity } from 'lucide-react';

interface DashboardHeaderProps {
  /** Small uppercase kicker above the title, e.g. the role. */
  eyebrow: string;
  /** Main page title. */
  title: string;
  /** One-line supporting description. */
  subtitle?: string;
  /** Optional right-aligned content (filters, actions). */
  children?: React.ReactNode;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Premium dashboard page header (TypeUI "Dashboard" system, light theme):
 * eyebrow kicker + strong title + a live date/meta chip on the right.
 * Shared across all role dashboards for a consistent data-platform feel.
 */
export function DashboardHeader({ eyebrow, title, subtitle, children }: DashboardHeaderProps) {
  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  return (
    <div className="portal-dash-head">
      <div className="min-w-0">
        <p className="portal-eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-[1.6rem] sm:text-[1.9rem] font-semibold tracking-[-0.02em] text-[#0b1220] leading-none">
          {title}
        </h1>
        {subtitle && <p className="text-[13.5px] text-gray-500 mt-2.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {children}
        <div className="hidden sm:inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/80 border border-[rgba(15,23,42,0.08)] shadow-[var(--shadow-sm)]">
          <Activity className="h-3.5 w-3.5 text-[#4069FF]" />
          <span className="text-[12.5px] font-medium text-gray-600 tabular-nums">{dateLabel}</span>
          <span className="portal-livepip" aria-hidden />
        </div>
      </div>
    </div>
  );
}
