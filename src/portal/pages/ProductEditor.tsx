import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormPageShell } from '../components/shared/FormPageShell';
import { useProducts, useCreateProduct, useUpdateProduct } from '../hooks/useProducts';
import { parseNumberInput } from '../lib/utils';
import type { Product } from '../types';

const UNITS = [
  { value: 'item', label: 'Per item' },
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'fixed', label: 'Fixed price' },
];

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data, isLoading, isError, refetch } = useProducts();
  const existing = isEdit ? data?.data.find(p => p.id === id) : undefined;
  const createP = useCreateProduct();
  const updateP = useUpdateProduct(id ?? '');

  const [form, setForm] = useState({ name: '', description: '', unitPrice: '', unit: 'item' as Product['unit'] });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setForm({ name: existing.name, description: existing.description ?? '', unitPrice: String(existing.unitPrice || ''), unit: existing.unit });
      setHydrated(true);
    }
  }, [isEdit, existing, hydrated]);

  const saving = createP.isPending || updateP.isPending;

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const body = { name: form.name.trim(), description: form.description || null, unitPrice: parseNumberInput(form.unitPrice) ?? 0, unit: form.unit };
    try {
      if (isEdit) { await updateP.mutateAsync(body); toast.success('Product updated'); }
      else { await createP.mutateAsync(body); toast.success('Product added'); }
      navigate('/portal/products', { replace: true });
    } catch { /* surfaced globally */ }
  };

  if (isEdit && isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isEdit && isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load catalog item. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <FormPageShell
      title={isEdit ? `Edit ${existing?.name ?? 'item'}` : 'New product / service'}
      backTo="/portal/products"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate('/portal/products')} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} loading={saving} loadingText="Saving…">{isEdit ? 'Save changes' : 'Add item'}</Button>
        </>
      }
    >
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Catalog item</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Consulting" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Unit price</Label><Input type="number" min={0} step="any" inputMode="decimal" placeholder="0.00" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v as Product['unit'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
