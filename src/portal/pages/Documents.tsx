import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, FileImage, FileSpreadsheet, FolderOpen, Loader2, Search, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DocumentDownloadButton } from '../components/shared/DocumentDownloadButton';
import { DocumentPreviewDialog } from '../components/shared/DocumentPreviewDialog';
import {
  useEmployee,
  useEmployees,
  useUploadEmployeeDocument,
  useDeleteEmployeeDocument,
} from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DOCUMENT_TYPES } from '../lib/documentTypes';
import type { Employee } from '../types';

const DOC_TYPES = DOCUMENT_TYPES;

// Badge tone per document type. Keep keys exactly matching DOC_TYPES so the
// pill colour matches what HR picked in the upload form.
const DOC_TYPE_TONE: Record<string, string> = {
  Resume:               'bg-blue-50 text-blue-700 border-blue-100',
  'Offer Letter':       'bg-violet-50 text-violet-700 border-violet-100',
  'ID Proof':           'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Compliance Document':'bg-amber-50 text-amber-700 border-amber-100',
  Other:                'bg-gray-50 text-gray-600 border-gray-100',
};

function DocTypeBadge({ type }: { type: string }) {
  const tone = DOC_TYPE_TONE[type] ?? DOC_TYPE_TONE.Other;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${tone}`}>
      {type}
    </span>
  );
}

// Pick a lucide icon based on the file extension. Falls back to FileText.
function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <FileImage className="h-5 w-5 text-blue-500" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <FileText className="h-5 w-5 text-gray-500" />;
}

function AvatarCircle({ first, last }: { first: string; last: string }) {
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
      {initials || '?'}
    </div>
  );
}

const EXPIRY_DOC_TYPES = new Set([
  'Passport', "Driver's License", 'State-Issued ID', 'Visa / Work Authorization',
  'I-94', 'Permanent Resident Card', 'Employment Authorization Document',
  'OPT Card', 'STEM OPT Card', 'I-983 Form',
]);

function ExpiryBadgeLocal({ date }: { date: string }) {
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (days < 0) return <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-red-50 text-red-700 border-red-200">Expired</span>;
  if (days <= 14) return <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-red-50 text-red-700 border-red-200">{days}d left</span>;
  if (days <= 30) return <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 text-amber-700 border-amber-200">{days}d left</span>;
  if (days <= 90) return <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-blue-50 text-blue-700 border-blue-200">{days}d left</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-gray-50 text-gray-600 border-gray-200">Exp {date}</span>;
}

function DocumentManager({ employee }: { employee: Employee }) {
  const upload = useUploadEmployeeDocument(employee.id);
  const remove = useDeleteEmployeeDocument(employee.id);
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null);

  const showExpiry = EXPIRY_DOC_TYPES.has(docType);

  const handleUpload = async () => {
    if (!docType || !file) {
      toast.error('Pick a document type and a file first');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    fd.append('docType', docType);
    if (expiryDate) fd.append('expiryDate', expiryDate);
    try {
      await upload.mutateAsync(fd);
      toast.success(`${file.name} uploaded`);
      setDocType('');
      setFile(null);
      setExpiryDate('');
      const input = document.getElementById('doc-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    setPendingDeleteId(id);
    try {
      await remove.mutateAsync(id);
      toast.success('Document deleted');
      setConfirmTarget(null);
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-[#4069FF]" />
            Add new document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">1. Document type *</Label>
              <Select value={docType} onValueChange={v => { setDocType(v); setExpiryDate(''); }}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">2. Pick a file *</Label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="block w-full h-10 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                3. Expiry date {showExpiry ? <span className="text-amber-600">(recommended)</span> : <span className="text-gray-400">(optional)</span>}
              </Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className={showExpiry ? 'border-amber-300 focus:ring-amber-400' : ''}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={!docType || !file}
                loading={upload.isPending}
                loadingText="Uploading…"
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                4. Upload
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Accepted: PDF, DOC, DOCX, JPG, PNG, XLS, CSV · Max 20 MB
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#4069FF]" />
            Documents on file ({employee.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10 text-gray-300" strokeWidth={1.5} />}
              title="No documents yet"
              description="Upload the first document above."
            />
          ) : (
            <div className="space-y-1">
              {employee.documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-3 -mx-3 rounded-md border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50/40"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      <FileTypeIcon name={doc.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <DocTypeBadge type={doc.type} />
                        <span className="text-xs text-muted-foreground">
                          Uploaded {formatDate(doc.uploadedAt)}
                        </span>
                        {doc.expiryDate && <ExpiryBadgeLocal date={doc.expiryDate} />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setPreviewDoc({ id: doc.id, name: doc.name })}>
                      Preview
                    </Button>
                    <DocumentDownloadButton docId={doc.id} fallbackUrl={doc.url} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      onClick={() => setConfirmTarget({ id: doc.id, name: doc.name })}
                      loading={pendingDeleteId === doc.id}
                      loadingText="Deleting…"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={open => { if (!open) setConfirmTarget(null); }}
        title={confirmTarget ? `Delete "${confirmTarget.name}"?` : 'Delete document?'}
        description="This will permanently remove the document. It cannot be undone."
        confirmLabel="Delete document"
        loading={!!pendingDeleteId}
        onConfirm={handleDelete}
      />

      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={open => { if (!open) setPreviewDoc(null); }}
        docId={previewDoc?.id ?? ''}
        fileName={previewDoc?.name ?? ''}
      />
    </div>
  );
}

function HrDocumentsView() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useEmployees({ limit: 500 });
  const { data: selected } = useEmployee(selectedId ?? undefined);
  const employees = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
      || (e.email ?? '').toLowerCase().includes(q)
      || (e.displayId ?? '').toLowerCase().includes(q)
      || (e.department ?? '').toLowerCase().includes(q)
      || (e.jobTitle ?? '').toLowerCase().includes(q)
    );
  }, [employees, query]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-[#4069FF]" />
            Pick an employee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, ID, email, dept…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="!pl-10 pr-3 h-9 text-sm"
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No matches</p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto space-y-1 -mx-2 px-2">
              {filtered.map(e => {
                const isSelected = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left rounded-md px-2 py-2 transition-colors flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50 ring-1 ring-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <AvatarCircle first={e.firstName} last={e.lastName} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {e.displayId ?? e.id.slice(0, 8)} · {e.jobTitle ?? '—'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        {!selectedId ? (
          <Card>
            <CardContent className="py-16">
              <EmptyState
                icon={<FolderOpen className="h-10 w-10 text-blue-400" strokeWidth={1.5} />}
                title="Select an employee to manage documents"
                description="Pick someone on the left to view, upload, or delete their resume, offer letter, ID proof, and compliance docs."
              />
              <p className="text-[11px] text-center text-gray-400 mt-2">
                💡 Tip — use the search box to find anyone by name, ID, email, or department.
              </p>
            </CardContent>
          </Card>
        ) : !selected ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AvatarCircle first={selected.firstName} last={selected.lastName} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Managing documents for</p>
                <p className="text-lg font-semibold truncate">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selected.displayId ?? selected.id.slice(0, 8)} · {selected.jobTitle ?? '—'} · {selected.department ?? '—'}
                </p>
              </div>
            </div>
            <DocumentManager employee={selected} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeDocumentsView() {
  const { user } = useAuth();
  const { data: employee, isLoading } = useEmployee(user?.employeeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!employee) {
    return (
      <Card>
        <CardContent className="py-16">
          <EmptyState
            title="No employee profile linked"
            description="Your account isn't linked to an employee record. Please contact HR."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl">
      <DocumentManager employee={employee} />
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const isHr = user?.role === 'admin' || user?.role === 'hr';
  const queryClient = useQueryClient();
  const handleRefresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

  return (
    <div>
      <PageHeader
        title="Documents"
        description={
          isHr
            ? 'Upload, view, or remove documents for any employee. Useful for storing resumes, offer letters, ID proofs and compliance paperwork in one place.'
            : 'Upload, view, or remove your own documents. Keep your resume, ID proof, and compliance paperwork up to date.'
        }
        onRefresh={handleRefresh}
      />
      {isHr ? <HrDocumentsView /> : <EmployeeDocumentsView />}
    </div>
  );
}
