import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquareWarning } from 'lucide-react';
import { useOnboardingChangeRequests } from '../../hooks/useEmployees';
import { formatDate } from '../../lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(dateStr);
}

export function OnboardingChangeHistoryDialog({
  employeeId, employeeName, open, onOpenChange,
}: {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: requests, isLoading } = useOnboardingChangeRequests(employeeId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-600" />
            Requested Changes — {employeeName}
          </DialogTitle>
          <DialogDescription>
            Every "Request Changes" message ever sent to this employee, newest first.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !requests?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No change requests have been sent yet.</p>
        ) : (
          <ScrollArea className="max-h-[60vh] -mx-1 px-1">
            <div className="space-y-3">
              {requests.map(r => (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border ${r.resolvedAt ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-500'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {r.requestedByName ?? 'HR'}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      r.resolvedAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.resolvedAt ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {timeAgo(r.requestedAt)}
                    {r.resolvedAt && ` · resolved ${timeAgo(r.resolvedAt)}`}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
