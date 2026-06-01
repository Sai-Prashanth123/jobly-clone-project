import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useProducts, useDeleteProduct } from '../hooks/useProducts';
import { formatCurrency } from '../lib/utils';
import type { Product } from '../types';

export default function Products() {
  const navigate = useNavigate();
  const { data, isLoading } = useProducts();
  const deleteP = useDeleteProduct();
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const products = data?.data ?? [];

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
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={e => { e.stopPropagation(); navigate(`/portal/products/${p.id}/edit`); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
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
        action={<Button onClick={() => navigate('/portal/products/new')} className="gap-2"><Plus className="h-4 w-4" /> New Item</Button>}
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
