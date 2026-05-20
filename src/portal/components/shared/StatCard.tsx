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
      className={`portal-glass-card portal-hover-lift p-3.5 flex flex-col h-full ${
        to ? 'group cursor-pointer' : ''
      } ${className ?? ''}`}
    >
      {/* Title row — icon + label on one line so the label has the full card width on the next line. */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.08em] truncate flex-1 min-w-0">
          {title}
        </p>
        {icon && (
          <div
            title={helper}
            className={`w-7 h-7 rounded-lg ${ICON_BG[variant]} flex items-center justify-center flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-[1.5rem] leading-none font-semibold text-gray-900 tabular-nums tracking-tight">
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} color={SPARK_STROKE[variant]} />
        )}
      </div>

      {description && (
        <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-1">{description}</p>
      )}

      {trend && (
        <div className="flex items-center gap-1 mt-1.5">
          {trend.value >= 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className={`text-[11px] font-semibold tabular-nums ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-[11px] text-gray-400">{trend.label}</span>
        </div>
      )}

      {to && (
        <div className="mt-2 pt-2 border-t border-gray-100/80 flex items-center justify-between text-[10px] font-medium text-gray-500 group-hover:text-[#4069FF] transition-colors">
          <span>{linkLabel ?? 'View'}</span>
          <ChevronRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} aria-label={`${title}: view details`} className="block h-full">{body}</Link>;
  }
  return body;
}
