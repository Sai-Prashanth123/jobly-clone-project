import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface QuickAction {
  label: string;
  to?: string;
  icon: LucideIcon;
  /** Tint name from the portal palette — applied to the icon. */
  tone?: 'blue' | 'cyan' | 'green' | 'orange' | 'violet' | 'red';
  onClick?: () => void;
}

const TONE_CLASS: Record<NonNullable<QuickAction['tone']>, string> = {
  blue:   'text-[#4069FF]',
  cyan:   'text-[#0EA5B5]',
  green:  'text-emerald-600',
  orange: 'text-amber-600',
  violet: 'text-violet-600',
  red:    'text-red-600',
};

interface Props {
  actions: QuickAction[];
  className?: string;
}

/**
 * Horizontal chip row of role-specific quick actions. Wraps on narrow screens
 * (no horizontal scroll). Used at the top of each dashboard.
 */
export function QuickActions({ actions, className }: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {actions.map((a, i) => {
        const Icon = a.icon;
        const tone = TONE_CLASS[a.tone ?? 'blue'];
        const inner = (
          <>
            <Icon className={`h-4 w-4 ${tone}`} />
            <span>{a.label}</span>
          </>
        );
        if (a.to) {
          return (
            <Link
              key={`${a.label}-${i}`}
              to={a.to}
              className="portal-quick-chip"
              aria-label={a.label}
            >
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={`${a.label}-${i}`}
            type="button"
            className="portal-quick-chip"
            onClick={a.onClick}
            aria-label={a.label}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
