import { TrendingUp, TrendingDown } from 'lucide-react';

type Variant = 'blue' | 'cyan' | 'green' | 'orange' | 'purple' | 'red';

const ICON_BG: Record<Variant, string> = {
  blue:   'bg-[#4069FF]/10   text-[#4069FF]',
  cyan:   'bg-[#32CDDC]/10   text-[#0EA5B5]',
  green:  'bg-emerald-500/10 text-emerald-600',
  orange: 'bg-amber-500/10   text-amber-600',
  purple: 'bg-violet-500/10  text-violet-600',
  red:    'bg-red-500/10     text-red-600',
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: Variant;
  trend?: { value: number; label: string };
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon, variant = 'blue', trend, description, className }: StatCardProps) {
  return (
    <div className={`portal-glass-card p-5 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em]">
            {title}
          </p>
          <p className="text-[1.65rem] leading-tight font-semibold text-gray-900 mt-2 tabular-nums tracking-tight">
            {value}
          </p>
          {description && (
            <p className="text-[12px] text-gray-400 mt-1.5">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 mt-3">
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs font-semibold tabular-nums ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${ICON_BG[variant]} flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
