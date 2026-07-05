import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, Trash2, Play, Pause, RotateCw, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import {
  useRecurringTemplates, useDeleteRecurring, useRunRecurringNow,
  type RecurringTemplate,
} from '../hooks/useRecurring';
import { formatCurrency, formatDate } from '../lib/utils';
import { apiClient } from '../lib/apiClient';
import { queryClient } from '../lib/queryClient';

// Plain helper (NOT a hook) so the pause/resume row action can update a template
// by id from inside a callback without violating the rules of hooks.
async function updateRecurringInline(id: string, body: Record<string, unknown>) {
  await apiClient.put(`/recurring-invoices/${id}`, body);
  queryClient.invalidateQueries({ queryKey: ['recurring'] });
}

export default function Recurring() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useRecurringTemplates();
  const deleteR = useDeleteRecurring();
  const runNow = useRunRecurringNow();
  const [delTarget, setDelTarget] = useState<RecurringTemplate | null>(null);

  const templates = data ?? [];

  const togglePause = async (t: RecurringTemplate) => {
    try {
      await updateRecurringInline(t.id, { status: t.status === 'active' ? 'paused' : 'active' });
      toast.success(t.status === 'active' ? 'Paused' : 'Resumed');
    } catch (err: any) {
      // updateRecurringInline is a raw apiClient call, not a useMutation — the
      // central toast handler in queryClient.ts never sees this.
      toast.error(err?.response?.data?.error ?? 'Failed to update the schedule.');
    }
  };

  const columns: Column<RecurringTemplate>[] = [
    { key: 'title', header: 'Schedule', render: t => <span className="font-medium">{t.title || t.clientName || t.clientId.slice(0, 8)}</span>, getValue: t => t.title ?? '' },
    { key: 'client', header: 'Client', hideOnMobile: true, render: t => t.clientName ?? t.clientId.slice(0, 8), getValue: t => t.clientName ?? '' },
    { key: 'frequency', header: 'Every', render: t => <span className="capitalize">{t.frequency}</span>, getValue: t => t.frequency },
    { key: 'amount', header: 'Amount', render: t => formatCurrency(t.lineItems.reduce((s, l) => s + (l.quantity * l.unitPrice), 0) * (1 + t.taxRate / 100), t.currency), getValue: () => '' },
    { key: 'nextRun', header: 'Next run', render: t => formatDate(t.nextRunDate), getValue: t => t.nextRunDate, sortable: true },
    { key: 'autoSend', header: 'Auto-send', hideOnMobile: true, render: t => t.autoSend ? 'Yes' : 'No', getValue: t => String(t.autoSend) },
    { key: 'status', header: 'Status', render: t => <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>, getValue: t => t.status },
    {
      key: 'actions', header: '', getValue: () => '',
      render: t => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" className="h-8 gap-1" title="Generate now"
            onClick={async e => { e.stopPropagation(); try { await runNow.mutateAsync(t.id); toast.success('Invoice generated'); } catch { /* failed-request toast raised centrally (queryClient.ts) */ } }}>
            <RotateCw className="h-3.5 w-3.5" /> Run now
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 sm:px-3" aria-label={t.status === 'active' ? 'Pause' : 'Resume'} onClick={e => { e.stopPropagation(); togglePause(t); }}>
            {t.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Pause</span></> : <><Play className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Resume</span></>}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 sm:px-3" aria-label="Edit" onClick={e => { e.stopPropagation(); navigate(`/portal/recurring/${t.id}/edit`); }}><Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span></Button>
          <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:bg-red-50" onClick={e => { e.stopPropagation(); setDelTarget(t); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Recurring Invoices"
        description={isLoading ? 'Loading…' : `${templates.length} schedule${templates.length === 1 ? '' : 's'}`}
        action={<Button onClick={() => navigate('/portal/recurring/new')} className="gap-2"><Plus className="h-4 w-4" /> New Schedule</Button>}
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load recurring schedules. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable data={templates} columns={columns} searchPlaceholder="Search schedules…" searchKeys={['title', 'clientName', 'frequency', 'status']} getRowKey={t => t.id}
          emptyTitle="No recurring invoices" emptyDescription="Set up a schedule to auto-generate invoices on a cadence." />
      )}

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={o => { if (!o) setDelTarget(null); }}
        title="Delete schedule?"
        description="Future invoices will stop generating. Already-generated invoices are unaffected."
        confirmLabel="Delete"
        loading={deleteR.isPending}
        onConfirm={async () => { if (!delTarget) return; try { await deleteR.mutateAsync(delTarget.id); toast.success('Deleted'); setDelTarget(null); } catch { /* failed-request toast raised centrally (queryClient.ts) */ } }}
      />
    </div>
  );
}
