import { CheckCircle2, Circle } from 'lucide-react';
import type { OnboardingStatus } from '../../types';

function barColor(o: OnboardingStatus): string {
  if (o.complete) return 'bg-emerald-500';
  return o.percent >= 50 ? 'bg-[#4069FF]' : 'bg-amber-500';
}

/** Compact bar + % — for table cells and dashboard rows. */
export function OnboardingBar({ onboarding }: { onboarding?: OnboardingStatus }) {
  if (!onboarding) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(onboarding)}`} style={{ width: `${onboarding.percent}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-gray-600 w-9 text-right">{onboarding.percent}%</span>
    </div>
  );
}

/** Full checklist — every required item with a tick/empty circle. For detail pages. */
export function OnboardingChecklist({ onboarding }: { onboarding?: OnboardingStatus }) {
  if (!onboarding) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">
          {onboarding.complete ? 'Profile complete' : 'Profile in progress'}
        </span>
        <span className={`text-sm font-bold tabular-nums ${onboarding.complete ? 'text-emerald-600' : 'text-[#4069FF]'}`}>
          {onboarding.percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className={`h-full rounded-full ${barColor(onboarding)} transition-all`} style={{ width: `${onboarding.percent}%` }} />
      </div>
      <ul className="space-y-1.5">
        {onboarding.items.map(item => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              : <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />}
            <span className={item.done ? 'text-gray-600' : 'text-gray-900 font-medium'}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
