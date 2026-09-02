import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, FileText, Inbox } from 'lucide-react';
import { DocumentPreviewDialog } from '../shared/DocumentPreviewDialog';
import { ExpiryBadge } from '../shared/ExpiryBadge';
import { formatDate } from '../../lib/utils';
import type { EmployeeDocument } from '../../types';

// Read-only view of the employee's own already-uploaded documents (onboarding/
// identity docs like I-797, passport, questionnaires) — a separate,
// non-overlapping set from this case's own categorized Documents tab
// (entity_type='case'). Upload/delete for these still only happens from the
// employee's own record (onboarding wizard or HR Edit) — this tab exists so
// Legal isn't blind to documents already on file when working a case.
export function CaseEmployeeDocuments({ documents }: { documents: EmployeeDocument[] }) {
  const [previewTarget, setPreviewTarget] = useState<EmployeeDocument | null>(null);

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
        <Inbox className="h-8 w-8 text-gray-300" />
        <p className="text-sm">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400 flex flex-wrap items-center gap-1.5">
                  <span>{doc.type}</span>
                  <span>· Uploaded {formatDate(doc.uploadedAt)}</span>
                  {doc.uploadedByName && <span>by {doc.uploadedByName}{doc.uploadedByRole && ` (${doc.uploadedByRole})`}</span>}
                  {doc.expiryDate && <ExpiryBadge date={doc.expiryDate} />}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={() => setPreviewTarget(doc)}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
          </div>
        ))}
      </div>

      <DocumentPreviewDialog
        open={!!previewTarget}
        onOpenChange={(open) => { if (!open) setPreviewTarget(null); }}
        docId={previewTarget?.id ?? ''}
        fileName={previewTarget?.name ?? ''}
      />
    </div>
  );
}
