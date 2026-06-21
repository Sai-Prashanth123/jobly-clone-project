import { useState } from 'react';
import { FileText, Plus, Trash2, Download, Send, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTaxDocuments, useCreateTaxDocument, useUpdateTaxDocument, useDeleteTaxDocument, type TaxDocType, type TaxDocument } from '../hooks/useTaxDocuments';
import { useEmployees } from '../hooks/useEmployees';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';

const DOC_TYPES: TaxDocType[] = ['W2','1099','other'];

export default function TaxDocuments() {
  const { user } = useAuth();
  const isFinance = user?.role === 'admin' || user?.role === 'finance';
  const { data: empResult } = useEmployees();
  const employees = empResult?.data ?? [];
  const [filterYear, setFilterYear] = useState<number | undefined>(new Date().getFullYear());
  const [filterEmp, setFilterEmp] = useState('');
  const { data: docs = [], isLoading } = useTaxDocuments({ taxYear: filterYear, employeeId: filterEmp || undefined });
  const create = useCreateTaxDocument();
  const update = useUpdateTaxDocument();
  const del = useDeleteTaxDocument();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaxDocument | null>(null);
  const [form, setForm] = useState({ employeeId: '', taxYear: new Date().getFullYear(), documentType: 'W2' as TaxDocType, fileUrl: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleSave = async () => {
    if (!form.employeeId) { setError('Employee required'); return; }
    setSaving(true); setError('');
    try { await create.mutateAsync(form); setOpen(false); } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const markSent = async (doc: TaxDocument) => {
    await update.mutateAsync({ id: doc.id, sentAt: new Date().toISOString() });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="h-6 w-6 text-green-600" /> Tax Documents</h1><p className="text-sm text-gray-500">W-2 and 1099 management</p></div>
        {isFinance && <Button size="sm" onClick={() => { setForm({ employeeId: '', taxYear: new Date().getFullYear(), documentType: 'W2', fileUrl: '', notes: '' }); setError(''); setOpen(true); }} className="gap-1"><Plus className="h-4 w-4" /> Generate</Button>}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={String(filterYear ?? '')} onValueChange={v => setFilterYear(v ? Number(v) : undefined)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All years" /></SelectTrigger>
          <SelectContent><SelectItem value="">All years</SelectItem>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        {isFinance && (
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All employees" /></SelectTrigger>
            <SelectContent><SelectItem value="">All employees</SelectItem>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><FileText className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No tax documents found</p></div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{doc.documentType}</span>
                  <span className="text-xs text-gray-500">Tax Year {doc.taxYear}</span>
                  {doc.sentAt && <span className="text-xs text-green-600 flex items-center gap-1"><Send className="h-3 w-3" />Sent {format(new Date(doc.sentAt), 'MMM d, yyyy')}</span>}
                </div>
                {isFinance && doc.employeeName && <p className="text-sm text-gray-500">{doc.employeeName} {doc.employeeDisplayId && `· ${doc.employeeDisplayId}`}</p>}
                {doc.notes && <p className="text-xs text-gray-400 mt-0.5">{doc.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1"><Download className="h-3.5 w-3.5" /> View</Button></a>}
                {isFinance && !doc.sentAt && <Button size="sm" variant="outline" className="gap-1" onClick={() => markSent(doc)}><Send className="h-3.5 w-3.5" /> Mark Sent</Button>}
                {isFinance && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(doc)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Generate Tax Document</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600 flex gap-1"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Employee *</Label>
              <Select value={form.employeeId} onValueChange={v => setForm(p => ({ ...p, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tax Year</Label><Input type="number" value={form.taxYear} onChange={e => setForm(p => ({ ...p, taxYear: Number(e.target.value) }))} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.documentType} onValueChange={v => setForm(p => ({ ...p, documentType: v as TaxDocType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>File URL (optional)</Label><Input value={form.fileUrl} onChange={e => setForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="https://…" /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Document?</AlertDialogTitle><AlertDialogDescription>Remove this tax document record?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { await del.mutateAsync(deleteTarget!.id); setDeleteTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
