import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, FileText } from 'lucide-react';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { useCaseDocuments, useUploadCaseDocument, useDeleteCaseDocument } from '../../hooks/useCases';
import { CASE_DOCUMENT_CATEGORIES, type CaseDocument } from '../../types';
import { formatDate } from '../../lib/utils';

export function CaseDocumentsPanel({ caseId }: { caseId: string }) {
  const { data: documents, isLoading } = useCaseDocuments(caseId);
  const uploadDoc = useUploadCaseDocument(caseId);
  const deleteDoc = useDeleteCaseDocument(caseId);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CaseDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCategoryRef = useRef<string | null>(null);

  const byCategory = new Map<string, CaseDocument[]>();
  for (const cat of CASE_DOCUMENT_CATEGORIES) byCategory.set(cat, []);
  for (const doc of documents ?? []) {
    const list = byCategory.get(doc.category) ?? byCategory.get('Other Documents, if any')!;
    list.push(doc);
  }

  const triggerUpload = (category: string) => {
    pendingCategoryRef.current = category;
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const category = pendingCategoryRef.current;
    e.target.value = '';
    if (!file || !category) return;
    setUploadingCategory(category);
    try {
      await uploadDoc.mutateAsync({ file, category });
      toast.success('Document uploaded');
    } catch {
      toast.error('Could not upload the document. Please try again.');
    } finally {
      setUploadingCategory(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
      {CASE_DOCUMENT_CATEGORIES.map(category => {
        const docs = byCategory.get(category) ?? [];
        return (
          <div key={category} className="rounded-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5">
              <p className="text-sm font-medium text-slate-800">{category}</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 flex-shrink-0"
                loading={uploadingCategory === category}
                loadingText="Uploading…"
                onClick={() => triggerUpload(category)}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>
            {docs.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">
                          Uploaded {formatDate(doc.uploadedAt)}
                          {doc.uploadedByName && ` by ${doc.uploadedByName}`}
                          {doc.uploadedByRole && ` (${doc.uploadedByRole})`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-600 hover:bg-red-50 flex-shrink-0"
                      onClick={() => setRemoveTarget(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Delete this document?"
        description="This document will be permanently removed from the case."
        confirmLabel="Delete"
        loading={deleteDoc.isPending}
        onConfirm={async () => {
          if (!removeTarget) return;
          try {
            await deleteDoc.mutateAsync(removeTarget.id);
            toast.success('Document deleted');
          } catch {
            toast.error('Could not delete the document. Please try again.');
          } finally {
            setRemoveTarget(null);
          }
        }}
      />
    </div>
  );
}
