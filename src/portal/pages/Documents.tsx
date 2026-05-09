import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';
import {
  useEmployee,
  useEmployees,
  useUploadEmployeeDocument,
  useDeleteEmployeeDocument,
} from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import type { Employee } from '../types';

const DOC_TYPES = ['Resume', 'Offer Letter', 'ID Proof', 'Compliance Document', 'Other'];

function DocumentManager({ employee }: { employee: Employee }) {
  const upload = useUploadEmployeeDocument(employee.id);
  const remove = useDeleteEmployeeDocument(employee.id);
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!docType || !file) {
      toast.error('Pick a document type and a file first');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    fd.append('docType', docType);
    try {
      await upload.mutateAsync(fd);
      toast.success(`${file.name} uploaded`);
      setDocType('');
      setFile(null);
      const input = document.getElementById('doc-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setPendingDeleteId(id);
    try {
      await remove.mutateAsync(id);
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Delete failed');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Add new document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Document type *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">File *</Label>
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="block w-full h-10 text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleUpload}
                disabled={!docType || !file || upload.isPending}
                className="w-full gap-2"
              >
                {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Accepted: PDF, DOC, DOCX, JPG, PNG · Max 20 MB
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents on file ({employee.documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <EmptyState title="No documents yet" description="Upload the first document above." />
          ) : (
            <div className="space-y-2">
              {employee.documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.type} · {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">Download</Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      disabled={pendingDeleteId === doc.id}
                    >
                      {pendingDeleteId === doc.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
          <CardTitle className="text-base">Pick an employee</CardTitle>
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
                const isActive = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                      isActive
                        ? 'bg-blue-50 ring-1 ring-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                      {e.firstName} {e.lastName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.displayId ?? e.id.slice(0, 8)} · {e.jobTitle ?? '—'}
                    </p>
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
                title="Select an employee"
                description="Pick someone on the left to view, upload, or delete their documents."
              />
            </CardContent>
          </Card>
        ) : !selected ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Managing documents for</p>
              <p className="text-lg font-semibold">{selected.firstName} {selected.lastName}</p>
              <p className="text-xs text-muted-foreground">
                {selected.displayId ?? selected.id.slice(0, 8)} · {selected.jobTitle ?? '—'} · {selected.department ?? '—'}
              </p>
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

  return (
    <div>
      <PageHeader
        title="Documents"
        description={
          isHr
            ? 'Upload, view, or remove documents for any employee.'
            : 'Upload, view, or remove your own documents.'
        }
      />
      {isHr ? <HrDocumentsView /> : <EmployeeDocumentsView />}
    </div>
  );
}
