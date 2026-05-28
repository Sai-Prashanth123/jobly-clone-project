import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInView } from '../../hooks/useInView';

export type BentoTone = 'navy' | 'blue' | 'cyan' | 'green' | 'orange' | 'violet' | 'red' | 'slate';

interface BentoTileProps {
  /** Tile span at md (≥768px) and lg (≥1024px) breakpoints. Mobile is always full-width. */
  span?: {
    md?: 1 | 2 | 3 | 4;
    lg?: 1 | 2 | 3 | 4 | 6;
    row?: 1 | 2;            // grid-row span at md+
    rowLg?: 1 | 2;          // grid-row span at lg+
  };
  /** Tiny uppercase label above the title. */
  eyebrow?: string;
  /** Tile heading (semibold). */
  title?: string;
  /** Optional subtitle / description (gray-500). */
  subtitle?: string;
  /** Lucide icon node — sits in a tinted square in the top-right corner. */
  icon?: React.ReactNode;
  /** Color tone for the icon background + accent. `navy` switches the whole tile to dark. */
  tone?: BentoTone;
  /** If set, the whole tile becomes a Link to this route. */
  to?: string;
  /** Optional CTA chip in the footer (e.g. "View all", appears next to an arrow). */
  cta?: string;
  /** Optional extra classes. */
  className?: string;
  /** Tile body (KPI value, chart, list, anything). */
  children?: React.ReactNode;
  /** Reveal-on-scroll delay (ms) for staggered entrances. */
  delay?: number;
}

const TONE_BG: Record<BentoTone, string> = {
  navy:   'bg-ink-800/8     text-ink-800',
  blue:   'bg-[#4069FF]/10  text-[#4069FF]',
  cyan:   'bg-[#32CDDC]/10  text-[#0EA5B5]',
  green:  'bg-emerald-500/10 text-emerald-600',
  orange: 'bg-amber-500/10  text-amber-600',
  violet: 'bg-violet-500/10 text-violet-600',
  red:    'bg-red-500/10    text-red-600',
  slate:  'bg-slate-500/10  text-slate-600',
};

const TONE_BG_DARK: Record<BentoTone, string> = {
  navy:   'bg-white/10      text-white',
  blue:   'bg-[#4069FF]/20  text-[#7BA1FF]',
  cyan:   'bg-[#32CDDC]/20  text-[#5FE7F4]',
  green:  'bg-emerald-500/20 text-emerald-300',
  orange: 'bg-amber-500/20  text-amber-300',
  violet: 'bg-violet-500/20 text-violet-300',
  red:    'bg-red-500/20    text-red-300',
  slate:  'bg-slate-500/20  text-slate-300',
};

const SPAN_MD: Record<2 | 3 | 4, string> = {
  2: 'bento-span-md-2',
  3: 'bento-span-md-3',
  4: 'bento-span-md-4',
};
const SPAN_LG: Record<2 | 3 | 4 | 6, string> = {
  2: 'bento-span-lg-2',
  3: 'bento-span-lg-3',
  4: 'bento-span-lg-4',
  6: 'bento-span-lg-6',
};

export function BentoTile({
  span,
  eyebrow,
  title,
  subtitle,
  icon,
  tone = 'slate',
  to,
  cta,
  className,
  children,
  delay = 0,
}: BentoTileProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const isNavy = tone === 'navy';

  const spanClasses = [
    span?.md && span.md !== 1 ? SPAN_MD[span.md] : '',
    span?.lg && span.lg !== 1 ? SPAN_LG[span.lg] : '',
    span?.row === 2 ? 'bento-row-md-2' : '',
    span?.rowLg === 2 ? 'bento-row-lg-2' : '',
  ].filter(Boolean).join(' ');

  const surfaceClasses = isNavy
    ? 'bento-tile-navy'
    : 'portal-glass-card';

  // Span classes go on the grid item (Link when `to`, otherwise the body div).
  const isLink = !!to;
  const body = (
    <div
      ref={ref}
      className={cn(
        'reveal portal-hover-lift group relative flex flex-col h-full p-5 sm:p-6',
        surfaceClasses,
        !isLink && spanClasses,
        inView && 'in',
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {(eyebrow || title || subtitle || icon) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className={cn(
                'eyebrow mb-1.5',
                isNavy ? '!text-white/55' : ''
              )}>
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className={cn(
                'text-[15px] font-semibold tracking-tight truncate',
                isNavy ? 'text-white' : 'text-ink-900'
              )}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={cn(
                'text-[12.5px] mt-0.5',
                isNavy ? 'text-white/65' : 'text-slate-500'
              )}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4 transition-transform duration-200 group-hover:scale-105',
              isNavy ? TONE_BG_DARK[tone] : TONE_BG[tone],
            )}>
              {icon}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">{children}</div>

      {cta && to && (
        <div className={cn(
          'mt-4 pt-3 border-t flex items-center justify-between text-[12px] font-medium transition-colors',
          isNavy
            ? 'border-white/10 text-white/70 group-hover:text-white'
            : 'border-slate-100 text-slate-500 group-hover:text-ink-800'
        )}>
          <span>{cta}</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className={cn('block focus:outline-none focus-visible:ring-4 focus-visible:ring-ink-800/15 rounded-[18px]', spanClasses)}>
        {body}
      </Link>
    );
  }
  return body;
}
