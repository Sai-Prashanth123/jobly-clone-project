import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Loader2, Plus, Package, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  useAssets, useCreateAsset, useUpdateAsset, useAssignAsset, useUnassignAsset, useDeleteAsset,
  type Asset, type AssetCategory, type AssetStatus, type AssetCondition,
  ASSET_CATEGORY_LABELS, ASSET_STATUS_COLORS,
} from '../hooks/useAssets';
import { useEmployees } from '../hooks/useEmployees';
import { formatDate } from '../lib/utils';

const CONDITION_LABELS: Record<AssetCondition, string> = {
  new: 'New', good: 'Good', fair: 'Fair', poor: 'Poor', damaged: 'Damaged',
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  available: 'Available', assigned: 'Assigned', maintenance: 'Maintenance', retired: 'Retired', lost: 'Lost',
};

const CATEGORIES = Object.entries(ASSET_CATEGORY_LABELS) as [AssetCategory, string][];
const STATUSES: AssetStatus[] = ['available', 'assigned', 'maintenance', 'retired', 'lost'];
const CONDITIONS: AssetCondition[] = ['new', 'good', 'fair', 'poor', 'damaged'];

interface AssetFormData {
  name: string; category: AssetCategory; brand: string; model: string;
  serialNumber: string; condition: AssetCondition; status: AssetStatus;
  purchaseDate: string; purchasePrice: string; warrantyExpiry: string; notes: string;
}

const EMPTY_FORM: AssetFormData = {
  name: '', category: 'laptop', brand: '', model: '', serialNumber: '',
  condition: 'good', status: 'available', purchaseDate: '', purchasePrice: '',
  warrantyExpiry: '', notes: '',
};

export default function Assets() {
  const { user } = useAuth();
  const role = user?.role ?? 'operations';
  const canManage = role === 'admin' || role === 'hr';

  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM);
  const [assignOpen, setAssignOpen] = useState<Asset | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<Asset | null>(null);

  const { data, isLoading } = useAssets({ status: statusFilter === 'all' ? undefined : statusFilter, category: categoryFilter === 'all' ? undefined : categoryFilter, limit: 50 });
  const assets = data?.data ?? [];
  const { data: employeesData } = useEmployees({ limit: 500, status: 'active' });
  const employees = employeesData?.data ?? [];

  const createMut = useCreateAsset();
  const updateMut = useUpdateAsset();
  const assignMut = useAssignAsset();
  const unassignMut = useUnassignAsset();
  const deleteMut = useDeleteAsset();

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); }
  function openEdit(a: Asset) {
    setEditing(a);
    setForm({
      name: a.name, category: a.category, brand: a.brand ?? '', model: a.model ?? '',
      serialNumber: a.serialNumber ?? '', condition: a.condition, status: a.status,
      purchaseDate: a.purchaseDate ?? '', purchasePrice: a.purchasePrice != null ? String(a.purchasePrice) : '',
      warrantyExpiry: a.warrantyExpiry ?? '', notes: a.notes ?? '',
    });
    setFormOpen(true);
  }

  async function saveAsset() {
    if (!form.name.trim()) { toast.error('Asset name is required'); return; }
    const pp = form.purchasePrice ? parseFloat(form.purchasePrice) : undefined;
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id, name: form.name, category: form.category,
          brand: form.brand || null, model: form.model || null,
          serialNumber: form.serialNumber || null, condition: form.condition,
          status: form.status, purchaseDate: form.purchaseDate || null,
          purchasePrice: pp ?? null, warrantyExpiry: form.warrantyExpiry || null,
          notes: form.notes || null,
        });
        toast.success('Asset updated');
      } else {
        await createMut.mutateAsync({
          name: form.name, category: form.category, brand: form.brand || null,
          model: form.model || null, serialNumber: form.serialNumber || null,
          condition: form.condition, status: form.status,
          purchaseDate: form.purchaseDate || null,
          purchasePrice: pp ?? null, warrantyExpiry: form.warrantyExpiry || null,
          notes: form.notes || null,
        });
        toast.success('Asset created');
      }
      setFormOpen(false);
    } catch { /* centrally handled */ }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Asset Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage company equipment and assignments</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(['all', ...STATUSES] as Array<AssetStatus | 'all'>).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All Status' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as AssetCategory | 'all')}>
          <SelectTrigger className="h-8 text-xs w-auto border-gray-200">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No assets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assets.map(asset => (
            <Card key={asset.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-blue-600 mb-0.5">{asset.displayId ?? asset.id.slice(0,8)}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{asset.name}</p>
                    {(asset.brand || asset.model) && (
                      <p className="text-xs text-muted-foreground truncate">{[asset.brand, asset.model].filter(Boolean).join(' ')}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${ASSET_STATUS_COLORS[asset.status]}`}>
                    {STATUS_LABELS[asset.status]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {ASSET_CATEGORY_LABELS[asset.category]}
                  </span>
                  <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {CONDITION_LABELS[asset.condition]}
                  </span>
                  {asset.serialNumber && (
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                      {asset.serialNumber}
                    </span>
                  )}
                </div>

                {asset.assignedTo && (
                  <div className="flex items-center gap-1.5 mb-3 py-1.5 px-2 bg-blue-50 rounded-lg">
                    <User className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-700 truncate">
                      {asset.employeeName ?? 'Assigned'} {asset.assignedAt ? `· ${formatDate(asset.assignedAt)}` : ''}
                    </p>
                  </div>
                )}

                {(asset.purchaseDate || asset.warrantyExpiry) && (
                  <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                    {asset.purchaseDate && <p>Purchased: {formatDate(asset.purchaseDate)}</p>}
                    {asset.warrantyExpiry && <p>Warranty until: {formatDate(asset.warrantyExpiry)}</p>}
                  </div>
                )}

                {canManage && (
                  <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                    <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => openEdit(asset)}>
                      Edit
                    </Button>
                    {asset.status === 'available' && (
                      <Button
                        size="sm"
                        className="text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => { setAssignOpen(asset); setAssignEmployeeId(''); }}
                      >
                        Assign
                      </Button>
                    )}
                    {asset.status === 'assigned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs flex-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                        loading={unassignMut.isPending}
                        onClick={() => setUnassignTarget(asset)}
                      >
                        Unassign
                      </Button>
                    )}
                    {asset.status !== 'assigned' && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 w-8 h-8 p-0 flex-shrink-0"
                        onClick={() => setDeleteTarget(asset)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update asset details.' : 'Register a new company asset.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ast-name">Asset Name *</Label>
              <Input id="ast-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. MacBook Pro 14″ M3" maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as AssetCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={v => setForm(p => ({ ...p, condition: v as AssetCondition }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map(c => <SelectItem key={c} value={c}>{CONDITION_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ast-brand">Brand</Label>
                <Input id="ast-brand" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="Apple" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ast-model">Model</Label>
                <Input id="ast-model" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="MNEH3LL/A" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ast-serial">Serial Number</Label>
              <Input id="ast-serial" value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} placeholder="C02XQ0JUJG5H" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AssetStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ast-purchase-date">Purchase Date</Label>
                <Input id="ast-purchase-date" type="date" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ast-price">Purchase Price</Label>
                <Input id="ast-price" type="number" min="0" step="0.01" value={form.purchasePrice}
                  onChange={e => setForm(p => ({ ...p, purchasePrice: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ast-warranty">Warranty Expiry</Label>
              <Input id="ast-warranty" type="date" value={form.warrantyExpiry} onChange={e => setForm(p => ({ ...p, warrantyExpiry: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ast-notes">Notes</Label>
              <Textarea id="ast-notes" value={form.notes} rows={2} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Additional details…" className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={saveAsset} loading={isSaving} loadingText="Saving…">
              {editing ? 'Update' : 'Add'} Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assignOpen} onOpenChange={open => { if (!open) setAssignOpen(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>{assignOpen?.name} → select an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} {e.displayId ? `(${e.displayId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)} disabled={assignMut.isPending}>Cancel</Button>
            <Button
              disabled={!assignEmployeeId}
              loading={assignMut.isPending}
              loadingText="Assigning…"
              onClick={async () => {
                if (!assignOpen || !assignEmployeeId) return;
                try {
                  await assignMut.mutateAsync({ id: assignOpen.id, employeeId: assignEmployeeId });
                  toast.success('Asset assigned');
                  setAssignOpen(null);
                } catch { /* centrally handled */ }
              }}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign confirm */}
      <ConfirmDialog
        open={!!unassignTarget}
        onOpenChange={open => { if (!open) setUnassignTarget(null); }}
        title="Unassign asset?"
        description={`Remove assignment of "${unassignTarget?.name}"? The asset will return to Available status.`}
        confirmLabel="Unassign"
        loading={unassignMut.isPending}
        onConfirm={async () => {
          if (!unassignTarget) return;
          try {
            await unassignMut.mutateAsync(unassignTarget.id);
            toast.success('Asset unassigned');
            setUnassignTarget(null);
          } catch { /* centrally handled */ }
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Delete asset?"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMut.mutateAsync(deleteTarget.id);
            toast.success('Asset deleted');
            setDeleteTarget(null);
          } catch { /* centrally handled */ }
        }}
      />
    </div>
  );
}
