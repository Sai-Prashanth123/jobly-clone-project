import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertCircle, Plus, Pencil, Trash2, FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { DetailField as Field } from '../components/shared/DetailField';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { CaseForm, CASE_TYPE_LABELS, CASE_STATUS_LABELS } from '../components/legal/CaseForm';
import { FilingForm } from '../components/legal/FilingForm';
import { CaseNotesThread } from '../components/legal/CaseNotesThread';
import { CaseDocumentsPanel } from '../components/legal/CaseDocumentsPanel';
import {
  useCase, useUpdateCase, useDeleteCase,
  useCreateFiling, useUpdateFiling, useDeleteFiling,
} from '../hooks/useCases';
import { formatDate } from '../lib/utils';
import type { CaseFiling, CaseStatus } from '../types';

const FILING_TYPE_LABELS: Record<string, string> = {
  cap_registration: 'CAP Registration',
  pwd: 'PWD',
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: legalCase, isLoading, isError } = useCase(id);
  const updateCase = useUpdateCase(id ?? '');
  const deleteCase = useDeleteCase();
  const createFiling = useCreateFiling(id ?? '');
  const updateFiling = useUpdateFiling(id ?? '');
  const deleteFiling = useDeleteFiling(id ?? '');

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filingDialog, setFilingDialog] = useState<{ mode: 'create' | 'edit'; filing?: CaseFiling } | null>(null);
  const [removeFilingTarget, setRemoveFilingTarget] = useState<CaseFiling | null>(null);
  const [section, setSection] = useState<'overview' | 'documents'>('overview');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !legalCase) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Could not load this case.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/portal/cases')}>Back to Cases</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/portal/cases')} className="gap-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold truncate">{legalCase.displayId}</h1>
              <StatusBadge status={legalCase.status} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {CASE_TYPE_LABELS[legalCase.caseType] ?? legalCase.caseType} — {legalCase.employeeFirstName} {legalCase.employeeLastName}
              {legalCase.employeeDisplayId && ` (${legalCase.employeeDisplayId})`}
              {legalCase.petitionerName && ` · Petitioner: ${legalCase.petitionerName}`}
              {legalCase.classification && ` · ${legalCase.classification}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={legalCase.status} onValueChange={async (v) => {
            try {
              await updateCase.mutateAsync({ status: v as CaseStatus });
              toast.success('Status updated');
            } catch {
              toast.error('Could not update status. Please try again.');
            }
          }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map(s => (
                <SelectItem key={s} value={s}>{CASE_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1.5 text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:w-48 flex-shrink-0 md:border-r md:border-gray-100 md:pr-3">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'documents', label: 'Documents' },
          ] as const).map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`text-left text-sm px-3 py-2 rounded-md whitespace-nowrap flex-shrink-0 ${
                section === s.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {section === 'overview' && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Field label="Receipt Number" value={legalCase.receiptNumber} />
                  <Field label="Attorney" value={legalCase.attorneyName} />
                  <Field label="Petitioner" value={legalCase.petitionerName} />
                  <Field label="Classification" value={legalCase.classification} />
                  <Field label="Priority Date" value={legalCase.priorityDate ? formatDate(legalCase.priorityDate) : undefined} />
                  <Field label="Filed Date" value={legalCase.filedDate ? formatDate(legalCase.filedDate) : undefined} />
                  <Field label="Decision Date" value={legalCase.decisionDate ? formatDate(legalCase.decisionDate) : undefined} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Employee Visa Expiry</p>
                    <p className="text-sm text-gray-900 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{legalCase.employeeVisaExpiry ? formatDate(legalCase.employeeVisaExpiry) : '—'}</span>
                      <ExpiryBadge date={legalCase.employeeVisaExpiry} />
                    </p>
                  </div>
                  {legalCase.description && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Description</p>
                      <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap break-words">{legalCase.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Filings</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFilingDialog({ mode: 'create' })}>
                    <Plus className="h-3.5 w-3.5" /> Add Filing
                  </Button>
                </CardHeader>
                <CardContent>
                  {legalCase.filings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
                      <FileStack className="h-8 w-8 text-gray-300" />
                      <p className="text-sm">No filings yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {legalCase.filings.map(f => (
                        <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{FILING_TYPE_LABELS[f.filingType] ?? f.filingType}</p>
                              <StatusBadge status={f.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {f.referenceNumber && `${f.referenceNumber} · `}
                              {f.filedDate ? `Filed ${formatDate(f.filedDate)}` : 'Not yet filed'}
                              {f.decisionDate && ` · Decided ${formatDate(f.decisionDate)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setFilingDialog({ mode: 'edit', filing: f })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setRemoveFilingTarget(f)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent>
                  <CaseNotesThread caseId={legalCase.id} notes={legalCase.notes} />
                </CardContent>
              </Card>
            </>
          )}

          {section === 'documents' && (
            <Card>
              <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
              <CardContent>
                <CaseDocumentsPanel caseId={legalCase.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Case {legalCase.displayId}</DialogTitle>
            <DialogDescription className="sr-only">Update case information.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <CaseForm
              initial={legalCase}
              isEdit
              onSubmit={async (formData) => {
                try {
                  await updateCase.mutateAsync({
                    caseType: formData.caseType as string,
                    status: formData.status,
                    receiptNumber: formData.receiptNumber || undefined,
                    priorityDate: formData.priorityDate || undefined,
                    filedDate: formData.filedDate || undefined,
                    decisionDate: formData.decisionDate || undefined,
                    attorneyName: formData.attorneyName || undefined,
                    description: formData.description || undefined,
                    petitionerId: formData.petitionerId || null,
                    classification: formData.classification || null,
                  });
                  toast.success('Case updated');
                  setEditOpen(false);
                } catch {
                  toast.error('Could not update the case. Please try again.');
                }
              }}
              onCancel={() => setEditOpen(false)}
              isPending={updateCase.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!filingDialog} onOpenChange={(open) => { if (!open) setFilingDialog(null); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{filingDialog?.mode === 'edit' ? 'Edit Filing' : 'Add Filing'}</DialogTitle>
            <DialogDescription className="sr-only">CAP Registration or PWD filing details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <FilingForm
              initial={filingDialog?.filing}
              onSubmit={async (formData) => {
                try {
                  if (filingDialog?.mode === 'edit' && filingDialog.filing) {
                    await updateFiling.mutateAsync({ filingId: filingDialog.filing.id, ...formData });
                    toast.success('Filing updated');
                  } else {
                    await createFiling.mutateAsync(formData);
                    toast.success('Filing added');
                  }
                  setFilingDialog(null);
                } catch {
                  toast.error('Could not save the filing. Please try again.');
                }
              }}
              onCancel={() => setFilingDialog(null)}
              isPending={createFiling.isPending || updateFiling.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeFilingTarget}
        onOpenChange={(open) => { if (!open) setRemoveFilingTarget(null); }}
        title="Remove this filing?"
        description="This filing will be removed from the case. This can be undone by contacting an administrator."
        confirmLabel="Remove"
        loading={deleteFiling.isPending}
        onConfirm={async () => {
          if (!removeFilingTarget) return;
          try {
            await deleteFiling.mutateAsync(removeFilingTarget.id);
            toast.success('Filing removed');
          } catch {
            toast.error('Could not remove the filing. Please try again.');
          } finally {
            setRemoveFilingTarget(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this case?"
        description="This case will be archived and removed from the active list. This can be undone by contacting an administrator."
        confirmLabel="Delete Case"
        loading={deleteCase.isPending}
        onConfirm={async () => {
          if (!id) return;
          try {
            await deleteCase.mutateAsync(id);
            toast.success('Case deleted');
            navigate('/portal/cases');
          } catch {
            toast.error('Could not delete the case. Please try again.');
            setDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
