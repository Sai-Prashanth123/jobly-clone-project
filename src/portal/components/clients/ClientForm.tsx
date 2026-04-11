import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Loader2 } from 'lucide-react';
import type { Client, BillingType } from '../../types';
import { useUploadClientDocument } from '../../hooks/useClients';
import { formatDate } from '../../lib/utils';
import { toast } from 'sonner';

type ClientFormData = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;

// Pending file entry for create mode
interface PendingDoc {
  file: File;
  name: string;
  type: string;
}

interface ClientFormProps {
  initial?: Partial<Client>;
  onSubmit: (data: ClientFormData, pendingFiles: Map<string, PendingDoc>) => void;
  onCancel: () => void;
  isEdit?: boolean;
  isPending?: boolean;
}

const defaultForm: ClientFormData = {
  companyName: '', contactName: '', contactEmail: '', contactPhone: '', industry: '',
  address: { street: '', city: '', state: '', zip: '', country: 'US' },
  contractStartDate: '', netPaymentDays: 30, defaultBillRate: 0,
  currency: 'USD', status: 'active', documents: [],
};

const DOC_TYPES = ['Client Agreement', 'NDA', 'MSA/SOW', 'Other'];

export function ClientForm({ initial, onSubmit, onCancel, isEdit = false, isPending = false }: ClientFormProps) {
  const uploadDoc = useUploadClientDocument(initial?.id ?? '');
  const [form, setForm] = useState<ClientFormData>({ ...defaultForm, ...initial, documents: initial?.documents ?? [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('basic');

  // Pending files (create mode) — key = temp id
  const [pendingFiles] = useState<Map<string, PendingDoc>>(new Map());

  // Document add state
  const [newDocType, setNewDocType] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const setAddr = (field: string, value: string) =>
    setForm(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));

  // ── Validation ────────────────────────────────────────────────────────────

  const tabFields: Record<string, string[]> = {
    basic:    ['companyName', 'contactName', 'contactEmail'],
    contract: ['contractStartDate'],
    billing:  [],
    docs:     [],
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.companyName.trim())    errs.companyName    = 'Company name is required';
    if (!form.contactName.trim())    errs.contactName    = 'Contact name is required';
    if (!form.contactEmail.trim())   errs.contactEmail   = 'Contact email is required';
    if (!form.contractStartDate)     errs.contractStartDate = 'Contract start date is required';
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      // Switch to first tab with errors
      for (const [tab, fields] of Object.entries(tabFields)) {
        if (fields.some(f => errs[f])) {
          setActiveTab(tab);
          break;
        }
      }
      toast.error('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const tabHasError = (tab: string) =>
    tabFields[tab]?.some(f => !!errors[f]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form, pendingFiles);
  };

  // ── Document upload ────────────────────────────────────────────────────────

  const addDocument = async () => {
    if (!newDocType || !newDocFile) {
      toast.error('Please select a file and document type');
      return;
    }

    const name = newDocFile.name;

    if (isEdit && initial?.id) {
      // Edit mode: upload immediately
      setUploading(true);
      const fd = new FormData();
      fd.append('file', newDocFile);
      fd.append('name', name);
      fd.append('docType', newDocType);
      fd.append('entityType', 'client');
      fd.append('entityId', initial.id);
      try {
        await uploadDoc.mutateAsync(fd);
        toast.success('Document uploaded');
      } catch {
        toast.error('Failed to upload document');
      } finally {
        setUploading(false);
      }
    } else {
      // Create mode: queue for upload after client is created
      const tempId = `pending-${Date.now()}`;
      pendingFiles.set(tempId, { file: newDocFile, name, type: newDocType });
      setForm(prev => ({
        ...prev,
        documents: [...prev.documents, { id: tempId, name, type: newDocType, uploadedAt: new Date().toISOString() }],
      }));
    }

    setNewDocFile(null);
    setNewDocType('');
    setShowAddDoc(false);
  };

  const removeDocument = (id: string) => {
    pendingFiles.delete(id);
    setForm(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== id) }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 h-auto gap-1">
          {(['basic', 'contract', 'billing', 'docs'] as const).map(tab => (
            <TabsTrigger key={tab} value={tab} className="relative capitalize">
              {tab === 'docs' ? 'Documents' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tabHasError(tab) && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Basic Info ─────────────────────────────────────────────── */}
        <TabsContent value="basic">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Company Name *</Label>
              <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} />
              {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contact Name *</Label>
              <Input value={form.contactName} onChange={e => set('contactName', e.target.value)} />
              {errors.contactName && <p className="text-xs text-red-500">{errors.contactName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
              {errors.contactEmail && <p className="text-xs text-red-500">{errors.contactEmail}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => set('industry', v)}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Other'].map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as 'active' | 'inactive')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Street Address</Label>
              <Input value={form.address?.street ?? ''} onChange={e => setAddr('street', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.address?.city ?? ''} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.address?.state ?? ''} onChange={e => setAddr('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={form.address?.zip ?? ''} onChange={e => setAddr('zip', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.address?.country ?? ''} onChange={e => setAddr('country', e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Contract ──────────────────────────────────────────────── */}
        <TabsContent value="contract">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Start Date *</Label>
              <Input type="date" value={form.contractStartDate} onChange={e => set('contractStartDate', e.target.value)} />
              {errors.contractStartDate && <p className="text-xs text-red-500">{errors.contractStartDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contract End Date</Label>
              <Input type="date" value={form.contractEndDate ?? ''} onChange={e => set('contractEndDate', e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Billing Type</Label>
              <Select value={form.billingType ?? ''} onValueChange={v => set('billingType', v as BillingType || null)}>
                <SelectTrigger><SelectValue placeholder="Select billing type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Billing ───────────────────────────────────────────────── */}
        <TabsContent value="billing">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select value={String(form.netPaymentDays ?? 30)} onValueChange={v => set('netPaymentDays', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Net 15 (15 days)</SelectItem>
                  <SelectItem value="30">Net 30 (30 days)</SelectItem>
                  <SelectItem value="45">Net 45 (45 days)</SelectItem>
                  <SelectItem value="60">Net 60 (60 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Bill Rate ($/hr)</Label>
              <Input type="number" min={0} step={0.01} value={form.defaultBillRate}
                onChange={e => set('defaultBillRate', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'CAD'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input value={form.taxId ?? ''} onChange={e => set('taxId', e.target.value)} placeholder="e.g. 12-3456789" />
            </div>

            {/* Billing Contact */}
            <div className="col-span-1 sm:col-span-2 border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Billing Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Contact Name</Label>
                  <Input value={form.billingContactName ?? ''} onChange={e => set('billingContactName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Billing Contact Email</Label>
                  <Input type="email" value={form.billingContactEmail ?? ''} onChange={e => set('billingContactEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Billing Contact Phone</Label>
                  <Input value={form.billingContactPhone ?? ''} onChange={e => set('billingContactPhone', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="col-span-1 sm:col-span-2 border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Billing Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <Label>Street</Label>
                  <Input value={form.billingStreet ?? ''} onChange={e => set('billingStreet', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.billingCity ?? ''} onChange={e => set('billingCity', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={form.billingState ?? ''} onChange={e => set('billingState', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input value={form.billingZip ?? ''} onChange={e => set('billingZip', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={form.billingCountry ?? ''} onChange={e => set('billingCountry', e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Documents ─────────────────────────────────────────────── */}
        <TabsContent value="docs">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Documents ({form.documents.length})</p>
              {!showAddDoc && (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddDoc(true)}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Document
                </Button>
              )}
            </div>

            {showAddDoc && (
              <div className="flex gap-2 items-end flex-wrap p-3 bg-gray-50 rounded-md border">
                <div className="w-48 space-y-1">
                  <Label className="text-xs">Document Type *</Label>
                  <Select value={newDocType} onValueChange={setNewDocType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs">File *</Label>
                  <input
                    type="file"
                    accept="*/*"
                    className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
                    onChange={e => setNewDocFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  type="button" size="sm"
                  onClick={addDocument}
                  disabled={!newDocType || !newDocFile || uploading || uploadDoc.isPending}
                >
                  {(uploading || uploadDoc.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => {
                  setShowAddDoc(false); setNewDocType(''); setNewDocFile(null);
                }}>
                  Cancel
                </Button>
              </div>
            )}

            {form.documents.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Date Added</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-sm font-medium">{doc.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doc.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</TableCell>
                        <TableCell>
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                No documents added yet. Click "Add Document" to upload.
              </p>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button
          type="submit"
          loading={isPending}
          loadingText={isEdit ? 'Saving…' : 'Creating…'}
        >
          {isEdit ? 'Save Changes' : 'Create Client'}
        </Button>
      </div>
    </form>
  );
}
