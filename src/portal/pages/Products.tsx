import { useState } from 'react';
import { Loader2, Plus, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';
import { formatCurrency, parseNumberInput } from '../lib/utils';
import type { Product } from '../types';

const UNITS = [
  { value: 'item', label: 'Per item' },
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'fixed', label: 'Fixed price' },
];

export default function Products() {
  const { data, isLoading } = useProducts();
  const createP = useCreateProduct();
  const [editing, setEditing] = useState<Product | null>(null);
  const updateP = useUpdateProduct(editing?.id ?? '');
  const deleteP = useDeleteProduct();

  const [open, setOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', unitPrice: '', unit: 'item' as Product['unit'] });

  const products = data?.data ?? [];

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', unitPrice: '', unit: 'item' }); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', unitPrice: String(p.unitPrice || ''), unit: p.unit });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const body = {
      name: form.name.trim(),
      description: form.description || null,
      unitPrice: parseNumberInput(form.unitPrice) ?? 0,
      unit: form.unit,
    };
    try {
      if (editing) { await updateP.mutateAsync(body); toast.success('Product updated'); }
      else { await createP.mutateAsync(body); toast.success('Product added'); }
      setOpen(false);
    } catch {
      /* failed-request toast raised centrally (queryClient.ts) */
    }
  };

  const columns: Column<Product>[] = [
    { key: 'name', header: 'Name', render: p => <span className="font-medium">{p.name}</span>, getValue: p => p.name, sortable: true },
    { key: 'description', header: 'Description', hideOnMobile: true, render: p => <span className="text-sm text-muted-foreground">{p.description ?? '—'}</span>, getValue: p => p.description ?? '' },
    { key: 'unit', header: 'Unit', render: p => <span className="text-sm capitalize">{p.unit}</span>, getValue: p => p.unit },
    { key: 'unitPrice', header: 'Price', render: p => formatCurrency(p.unitPrice), getValue: p => String(p.unitPrice), sortable: true },
    { key: 'active', header: 'Status', render: p => <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{p.active ? 'Active' : 'Archived'}</span>, getValue: p => (p.active ? 'active' : 'archived') },
    {
      key: 'actions', header: '', getValue: () => '',
      render: p => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={e => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          {p.active && <Button variant="ghost" size="sm" className="h-8 gap-1 text-amber-600 hover:bg-amber-50" onClick={e => { e.stopPropagation(); setArchiveTarget(p); }}><Archive className="h-3.5 w-3.5" /> Archive</Button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Products & Services"
        description={isLoading ? 'Loading…' : `${products.length} catalog item${products.length === 1 ? '' : 's'}`}
        action={<Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Item</Button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable
          data={products}
          columns={columns}
          searchPlaceholder="Search items…"
          searchKeys={['name', 'description', 'unit']}
          getRowKey={p => p.id}
          emptyTitle="No catalog items yet"
          emptyDescription="Add reusable products/services to drop into invoices in one click."
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit item' : 'New product / service'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Consulting" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Unit price</Label><Input type="number" min={0} step="any" inputMode="decimal" placeholder="0.00" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v as Product['unit'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={createP.isPending || updateP.isPending} loadingText="Saving…">{editing ? 'Save' : 'Add item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={o => { if (!o) setArchiveTarget(null); }}
        title={`Archive ${archiveTarget?.name}?`}
        description="It will be hidden from the invoice catalog. Existing invoices keep their items."
        confirmLabel="Archive"
        loading={deleteP.isPending}
        onConfirm={async () => {
          if (!archiveTarget) return;
          try { await deleteP.mutateAsync(archiveTarget.id); toast.success('Archived'); setArchiveTarget(null); }
          catch { /* failed-request toast raised centrally (queryClient.ts) */ }
        }}
      />
    </div>
  );
}
