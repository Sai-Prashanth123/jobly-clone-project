import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { CaseForm, CASE_TYPE_LABELS } from '../components/legal/CaseForm';
import { useCases, useCreateCase } from '../hooks/useCases';
import { formatDate } from '../lib/utils';
import type { LegalCase } from '../types';

export default function Cases() {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useCases({ limit: 500 });
  const createCase = useCreateCase();
  const [showForm, setShowForm] = useState(false);

  const cases = data?.data ?? [];

  const columns: Column<LegalCase>[] = [
    {
      key: 'id',
      header: 'Case',
      render: c => <span className="text-xs font-mono text-blue-600">{c.displayId ?? c.id.slice(0, 8)}</span>,
      getValue: c => c.displayId ?? c.id.slice(0, 8),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: c => (
        <div>
          <p className="font-medium text-sm">{c.employeeFirstName} {c.employeeLastName}</p>
          <p className="text-xs text-muted-foreground">{c.employeeDisplayId}</p>
        </div>
      ),
      getValue: c => `${c.employeeFirstName ?? ''} ${c.employeeLastName ?? ''}`,
    },
    {
      key: 'caseType',
      header: 'Type',
      render: c => CASE_TYPE_LABELS[c.caseType] ?? c.caseType,
      getValue: c => CASE_TYPE_LABELS[c.caseType] ?? c.caseType,
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status} />,
      getValue: c => c.status,
    },
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      hideOnMobile: true,
      render: c => c.receiptNumber || <span className="text-xs text-gray-400">—</span>,
      getValue: c => c.receiptNumber ?? '',
    },
    {
      key: 'filedDate',
      header: 'Filed',
      hideOnMobile: true,
      render: c => c.filedDate ? formatDate(c.filedDate) : <span className="text-xs text-gray-400">—</span>,
      getValue: c => c.filedDate ?? '',
    },
    {
      key: 'visaExpiry',
      header: 'Visa Expiry',
      hideOnMobile: true,
      render: c => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{c.employeeVisaExpiry ? formatDate(c.employeeVisaExpiry) : '—'}</span>
          <ExpiryBadge date={c.employeeVisaExpiry} />
        </div>
      ),
      getValue: c => c.employeeVisaExpiry ?? '',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cases"
        description={isLoading ? 'Loading…' : `${cases.length} total cases`}
        action={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        }
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load cases. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={cases}
          columns={columns}
          searchPlaceholder="Search by case ID, receipt number…"
          searchKeys={['displayId', 'receiptNumber']}
          getRowKey={c => c.id}
          onRowClick={c => navigate(`/portal/cases/${c.id}`)}
          emptyTitle="No cases found"
          emptyDescription="Create your first case to start tracking an immigration matter."
        />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Case</DialogTitle>
            <DialogDescription className="sr-only">Fill in the case details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <CaseForm
              onSubmit={async (formData) => {
                try {
                  const created = await createCase.mutateAsync({
                    employeeId: formData.employeeId,
                    caseType: formData.caseType as string,
                    receiptNumber: formData.receiptNumber || undefined,
                    priorityDate: formData.priorityDate || undefined,
                    filedDate: formData.filedDate || undefined,
                    decisionDate: formData.decisionDate || undefined,
                    attorneyName: formData.attorneyName || undefined,
                    description: formData.description || undefined,
                  });
                  toast.success(`Case ${created.displayId ?? created.id} created`);
                  setShowForm(false);
                  navigate(`/portal/cases/${created.id}`);
                } catch {
                  /* failed-request toast raised centrally (queryClient.ts) */
                }
              }}
              onCancel={() => setShowForm(false)}
              isPending={createCase.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
