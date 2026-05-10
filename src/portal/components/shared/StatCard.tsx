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

const SPARK_STROKE: Record<Variant, string> = {
  blue:   '#4069FF',
  cyan:   '#0EA5B5',
  green:  '#10B981',
  orange: '#F59E0B',
  purple: '#7C3AED',
  red:    '#EF4444',
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: Variant;
  trend?: { value: number; label: string };
  description?: string;
  /** Optional time-series for the sparkline drawn under the value. */
  sparkline?: number[];
  className?: string;
}

/** Tiny inline-SVG sparkline. No deps. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 96;
  const h = 28;
  const pad = 1.5;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const lastY = pad + (h - pad * 2) * (1 - (data[data.length - 1] - min) / range);
  const lastX = pad + (data.length - 1) * stepX;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="opacity-90"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#spark-fill-${color.replace('#', '')})`}
        points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

export function StatCard({
  title,
  value,
  icon,
  variant = 'blue',
  trend,
  description,
  sparkline,
  className,
}: StatCardProps) {
  return (
    <div className={`portal-glass-card portal-hover-lift p-5 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em]">
            {title}
          </p>
          <p className="text-[1.7rem] leading-tight font-semibold text-gray-900 mt-2 tabular-nums tracking-tight">
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
              <span
                className={`text-xs font-semibold tabular-nums ${
                  trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {icon && (
            <div
              className={`w-10 h-10 rounded-xl ${ICON_BG[variant]} flex items-center justify-center`}
            >
              {icon}
            </div>
          )}
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} color={SPARK_STROKE[variant]} />
          )}
        </div>
      </div>
    </div>
  );
}
