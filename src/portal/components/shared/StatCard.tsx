import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  /** When set, the whole card becomes a Link to this route. */
  to?: string;
  /** Footer affordance label (only shown when `to` is set). */
  linkLabel?: string;
  /** Hover tooltip on the icon explaining the metric. */
  helper?: string;
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
  to,
  linkLabel,
  helper,
  className,
}: StatCardProps) {
  const body = (
    <div
      className={`portal-glass-card portal-hover-lift p-5 flex flex-col h-full ${
        to ? 'group cursor-pointer' : ''
      } ${className ?? ''}`}
    >
      {/* Title row — eyebrow label + accent icon square. */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="eyebrow truncate flex-1 min-w-0 mt-0.5">{title}</p>
        {icon && (
          <div
            title={helper}
            className={`w-9 h-9 rounded-xl ${ICON_BG[variant]} flex items-center justify-center flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4 transition-transform duration-200 group-hover:scale-105`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-end justify-between gap-2">
        <p
          className="leading-none font-semibold text-ink-900 tabular-nums tracking-tight"
          style={{ fontSize: 'clamp(1.625rem, 2.4vw, 2rem)' }}
        >
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} color={SPARK_STROKE[variant]} />
        )}
      </div>

      {description && (
        <p className="text-[12px] text-slate-500 mt-2 line-clamp-1">{description}</p>
      )}

      {trend && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend.value >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={`text-[12px] font-semibold tabular-nums ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-[12px] text-slate-400">{trend.label}</span>
        </div>
      )}

      {to && (
        <div className="mt-auto pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11.5px] font-medium text-slate-500 group-hover:text-ink-800 transition-colors">
          <span>{linkLabel ?? 'View'}</span>
          <ChevronRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} aria-label={`${title}: view details`} className="block h-full">{body}</Link>;
  }
  return body;
}
