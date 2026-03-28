import { TrendingUp, TrendingDown } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

type Variant = 'blue' | 'cyan' | 'green' | 'orange' | 'purple' | 'red';

const ICON_BG: Record<Variant, string> = {
  blue:   'from-[#4069FF]/15 to-[#4069FF]/5 text-[#4069FF]',
  cyan:   'from-[#32CDDC]/15 to-[#32CDDC]/5 text-[#32CDDC]',
  green:  'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  orange: 'from-amber-500/15  to-amber-500/5  text-amber-600',
  purple: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  red:    'from-red-500/15    to-red-500/5    text-red-600',
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
  const cardRef = useScrollReveal<HTMLDivElement>('animate__fadeInUp');
  return (
    <div ref={cardRef} className={`portal-glass-card portal-animate-in p-5 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">{value}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`ml-3 flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br ${ICON_BG[variant]} flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
