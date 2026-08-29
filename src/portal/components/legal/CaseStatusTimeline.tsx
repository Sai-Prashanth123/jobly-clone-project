import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { useCompleteStatusStep } from '../../hooks/useCases';
import { formatDate } from '../../lib/utils';
import type { CaseStatusStep } from '../../types';

export function CaseStatusTimeline({ caseId, steps }: { caseId: string; steps: CaseStatusStep[] }) {
  const completeStep = useCompleteStatusStep(caseId);
  const firstIncompleteIndex = steps.findIndex(s => !s.completedAt);

  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Status</p>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isCurrent = i === firstIncompleteIndex;
          return (
            <div key={step.key} className="flex items-start gap-2.5 relative pb-4 last:pb-0">
              {i < steps.length - 1 && (
                <div className={`absolute left-[9px] top-5 bottom-0 w-px ${step.completedAt ? 'bg-green-200' : 'bg-gray-100'}`} />
              )}
              <button
                type="button"
                disabled={!!step.completedAt || completeStep.isPending}
                onClick={async () => {
                  try {
                    await completeStep.mutateAsync(step.key);
                  } catch {
                    toast.error('Could not update this step. Please try again.');
                  }
                }}
                className="flex-shrink-0 mt-0.5 disabled:cursor-default"
                title={step.completedAt ? undefined : 'Mark complete'}
              >
                {step.completedAt ? (
                  <CheckCircle2 className="h-[18px] w-[18px] text-green-600" />
                ) : (
                  <Circle className={`h-[18px] w-[18px] ${isCurrent ? 'text-blue-500' : 'text-gray-300'}`} />
                )}
              </button>
              <div className="min-w-0">
                <p className={`text-sm leading-tight ${step.completedAt ? 'text-gray-900' : isCurrent ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {step.completedAt && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(step.completedAt)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
