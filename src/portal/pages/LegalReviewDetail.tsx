import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertCircle, FlagTriangleRight, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EmployeeAvatar } from '../components/shared/EmployeeAvatar';
import { DetailField as Field } from '../components/shared/DetailField';
import { ExpiryBadge } from '../components/shared/ExpiryBadge';
import { DocumentPreviewDialog } from '../components/shared/DocumentPreviewDialog';
import { useEmployee, useSetDocumentLegalReview } from '../hooks/useEmployees';
import { apiClient } from '../lib/apiClient';
import { formatDate } from '../lib/utils';

const E_VERIFY_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  pending: 'Pending',
  employment_authorized: 'Employment Authorized',
  tentative_nonconfirmation: 'Tentative Nonconfirmation',
  case_closed: 'Case Closed',
};

// Dependents live in a private bucket like every other document — fetch a
// fresh signed URL per click rather than trusting a stored one (mirrors
// DocumentDownloadButton's pattern for the shared `documents` table).
function DependentPassportButton({ employeeId, dependentId }: { employeeId: string; dependentId: string }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    const win = window.open('about:blank', '_blank');
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/employees/${employeeId}/dependents/${dependentId}/passport-url`);
      const url: string | undefined = data?.url;
      if (!url) {
        win?.close();
        toast.error('Could not generate a link. Please try again.');
        return;
      }
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      win?.close();
      toast.error(err?.response?.data?.error ?? 'Could not generate a link. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleClick}>
      View Passport
    </Button>
  );
}

function DocumentReviewRow({ employeeId, doc }: { employeeId: string; doc: { id: string; name: string; type: string; uploadedAt: string; expiryDate?: string; legalFlagged?: boolean; legalFlagComment?: string | null } }) {
  const setLegalReview = useSetDocumentLegalReview();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [flagged, setFlagged] = useState(!!doc.legalFlagged);
  const [comment, setComment] = useState(doc.legalFlagComment ?? '');
  const dirty = flagged !== !!doc.legalFlagged || comment !== (doc.legalFlagComment ?? '');

  const handleSave = async () => {
    try {
      await setLegalReview.mutateAsync({ docId: doc.id, legalFlagged: flagged, legalFlagComment: comment.trim() || null });
      toast.success(flagged ? 'Document flagged for HR.' : 'Flag cleared.');
    } catch {
      toast.error('Could not save. Please try again.');
    }
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-0 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">{doc.name}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <p className="text-xs text-muted-foreground">{doc.type} • {formatDate(doc.uploadedAt)}</p>
            {doc.expiryDate && <ExpiryBadge date={doc.expiryDate} />}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <FileText className="h-3.5 w-3.5 mr-1.5" /> Preview
        </Button>
      </div>

      <div className="flex items-start gap-2 bg-gray-50 rounded-md p-2.5">
        <Checkbox
          id={`flag-${doc.id}`}
          checked={flagged}
          onCheckedChange={(v) => setFlagged(!!v)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <label htmlFor={`flag-${doc.id}`} className="text-xs font-medium text-gray-700 flex items-center gap-1.5 cursor-pointer">
            <FlagTriangleRight className="h-3.5 w-3.5 text-red-500" /> Flag for HR&rsquo;s attention
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional note for HR…"
            rows={2}
            maxLength={2000}
            className="text-sm resize-y bg-white"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={!dirty} loading={setLegalReview.isPending}>
              Save
            </Button>
          </div>
        </div>
      </div>

      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        docId={doc.id}
        fileName={doc.name}
      />
    </div>
  );
}

export default function LegalReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employee, isLoading, isError } = useEmployee(id);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Could not load this employee.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/portal/legal-review')}>Back to Legal Review</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/portal/legal-review')} className="gap-1 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <EmployeeAvatar photoUrl={employee.profilePhotoUrl} name={`${employee.firstName} ${employee.lastName}`} size="md" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{employee.firstName} {employee.lastName}</h1>
          <span className="text-xs font-mono text-blue-600">{employee.displayId ?? employee.id.slice(0, 8)}</span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Immigration &amp; I-9</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Nationality" value={employee.nationality} />
          <Field label="Visa Type" value={employee.visaType?.toUpperCase()} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Visa Expiry</p>
            <p className="text-sm text-gray-900 mt-0.5 flex flex-wrap items-center gap-2">
              <span>{formatDate(employee.visaExpiry)}</span>
              <ExpiryBadge date={employee.visaExpiry} />
            </p>
          </div>
          <Field label="I-9 Status" value={employee.i9Status} />
          <Field label="E-Verify Status" value={employee.eVerifyStatus ? E_VERIFY_STATUS_LABELS[employee.eVerifyStatus] : undefined} />
          <Field label="E-Verify Case Number" value={employee.eVerifyCaseNumber} />
        </CardContent>
      </Card>

      {(employee.dependents?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">H-4 Dependents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {employee.dependents!.map((dep, i) => (
              <div key={dep.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium">
                    {dep.relationship === 'spouse' ? 'Spouse' : `Child ${employee.dependents!.filter(d => d.relationship === 'child').findIndex(d => d.id === dep.id) + 1}`}
                    {(dep.firstName || dep.lastName) && ` — ${dep.firstName ?? ''} ${dep.lastName ?? ''}`.trim()}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {dep.passportExpiry && (
                      <p className="text-xs text-muted-foreground">Passport expires {formatDate(dep.passportExpiry)}</p>
                    )}
                    <ExpiryBadge date={dep.passportExpiry} />
                  </div>
                </div>
                {dep.passportStoragePath && (
                  <DependentPassportButton employeeId={employee.id} dependentId={dep.id} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {employee.documents.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
          <CardContent>
            <div>
              {employee.documents.map(doc => (
                <DocumentReviewRow key={doc.id} employeeId={employee.id} doc={doc} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-400">
            No documents on file for this employee.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
