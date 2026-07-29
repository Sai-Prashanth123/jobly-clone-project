import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, Loader2, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable } from '../components/shared/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useExpiringDocuments, useRequestEmployeeDocuments, type ExpiringDocEntry } from '../hooks/useEmployees';

function urgencyBadge(days: number) {
  if (days <= 14) return <Badge variant="destructive">{days}d left</Badge>;
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d left</Badge>;
  return <Badge variant="secondary">{days}d left</Badge>;
}

function docTypeBadge(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('passport'))   return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{type}</Badge>;
  if (lower.includes('visa') || lower.includes('work auth')) return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{type}</Badge>;
  if (lower.includes('opt') || lower.includes('stem'))       return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{type}</Badge>;
  if (lower.includes('i-983') || lower.includes('i983'))     return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{type}</Badge>;
  if (lower.includes('driver') || lower.includes('license')) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{type}</Badge>;
  return <Badge variant="outline">{type}</Badge>;
}

export function ExpiringDocuments() {
  const navigate = useNavigate();
  const [days, setDays] = useState(90);
  const { data: docs = [], isLoading, isError, isFetching, refetch } = useExpiringDocuments(days);
  const requestDocuments = useRequestEmployeeDocuments();
  const [notifyTarget, setNotifyTarget] = useState<ExpiringDocEntry | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r: ExpiringDocEntry) => (
        <div>
          <div className="font-medium text-sm">{r.firstName} {r.lastName}</div>
          <div className="text-xs text-gray-400">{r.displayId}</div>
        </div>
      ),
      getValue: (r: ExpiringDocEntry) => `${r.firstName} ${r.lastName}`,
    },
    {
      key: 'documentType',
      header: 'Document',
      render: (r: ExpiringDocEntry) => docTypeBadge(r.documentType),
      getValue: (r: ExpiringDocEntry) => r.documentType,
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (r: ExpiringDocEntry) => (
        <span className="text-sm">{new Date(r.expiryDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      ),
      getValue: (r: ExpiringDocEntry) => r.expiryDate,
    },
    {
      key: 'daysRemaining',
      header: 'Time Remaining',
      render: (r: ExpiringDocEntry) => urgencyBadge(r.daysRemaining),
      getValue: (r: ExpiringDocEntry) => String(r.daysRemaining),
    },
    {
      key: 'actions',
      header: '',
      getValue: () => '',
      render: (r: ExpiringDocEntry) => (
        <div onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost" size="sm" className="h-8 gap-1.5 text-blue-700 hover:bg-blue-50"
            onClick={() => {
              setNotifyMessage(`Your ${r.documentType} is expiring on ${new Date(r.expiryDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} — please upload a renewed copy from your profile page.`);
              setNotifyTarget(r);
            }}
          >
            <Mail className="h-3.5 w-3.5" /> Notify
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiring Documents"
        description={`Documents expiring within the next ${days} days.`}
        action={
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Next 30 days</SelectItem>
              <SelectItem value="60">Next 60 days</SelectItem>
              <SelectItem value="90">Next 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load expiring documents. Please refresh.</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <FileWarning className="h-10 w-10 text-gray-300" />
          <p className="text-sm">No documents expiring in the next {days} days.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          getRowKey={r => `${r.employeeId}-${r.documentType}-${r.expiryDate}`}
          onRowClick={r => navigate(`/portal/employees/${r.employeeId}`)}
          emptyTitle="No expiring documents found"
          searchPlaceholder="Search by name, document type…"
          searchKeys={['firstName', 'lastName', 'documentType', 'displayId'] as (keyof ExpiringDocEntry)[]}
        />
      )}

      <Dialog open={!!notifyTarget} onOpenChange={(open) => !requestDocuments.isPending && !open && setNotifyTarget(null)}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Notify {notifyTarget?.firstName} {notifyTarget?.lastName}</DialogTitle>
            <DialogDescription>
              They&rsquo;ll get an email + in-app notification about their expiring {notifyTarget?.documentType}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              disabled={requestDocuments.isPending}
              className="resize-y"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyTarget(null)} disabled={requestDocuments.isPending}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!notifyTarget) return;
                const msg = notifyMessage.trim();
                if (msg.length < 1) {
                  toast.error('Please enter a message.');
                  return;
                }
                try {
                  await requestDocuments.mutateAsync({ employeeId: notifyTarget.employeeId, message: msg });
                  toast.success(`${notifyTarget.firstName} has been notified.`);
                  setNotifyTarget(null);
                } catch {
                  toast.error('Could not send the request. Please try again.');
                }
              }}
              loading={requestDocuments.isPending}
              loadingText="Sending…"
              disabled={notifyMessage.trim().length < 1}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExpiringDocuments;
