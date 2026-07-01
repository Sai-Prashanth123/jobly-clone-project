import { useState } from 'react';
import { DollarSign, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useBudgets, useUpsertBudget, useDeleteBudget, type BudgetType, type Budget } from '../hooks/useBudgets';

const BUDGET_TYPES: BudgetType[] = ['headcount','opex','capex'];
const TYPE_LABELS: Record<BudgetType, string> = { headcount:'Headcount', opex:'OpEx', capex:'CapEx' };
const TYPE_COLORS: Record<BudgetType, string> = { headcount:'bg-blue-100 text-blue-700', opex:'bg-violet-100 text-violet-700', capex:'bg-amber-100 text-amber-700' };

const DEPTS = ['Engineering','Product','Design','Sales','Marketing','HR','Finance','Operations','Legal','Customer Success','Other'];

export default function Budgets() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: budgets = [], isLoading } = useBudgets(selectedYear);
  const upsert = useUpsertBudget();
  const del = useDeleteBudget();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Budget,'id'>>({ department: '', fiscalYear: selectedYear, budgetType: 'opex', budgetAmount: 0, notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.department || form.budgetAmount <= 0) { setError('Department and positive amount required'); return; }
    setSaving(true); setError('');
    try { await upsert.mutateAsync(form); setOpen(false); } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const grouped = budgets.reduce((acc: Record<string, Budget[]>, b) => { (acc[b.department] = acc[b.department] ?? []).push(b); return acc; }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><DollarSign className="h-6 w-6 text-green-600" /> Budget Tracker</h1><p className="text-sm text-gray-500">FY {selectedYear} department budgets</p></div>
        <div className="flex items-center gap-2">
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setForm({ department: '', fiscalYear: selectedYear, budgetType: 'opex', budgetAmount: 0, notes: '' }); setError(''); setOpen(true); }} className="gap-1"><Plus className="h-4 w-4" /> Add Budget</Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-gray-400"><DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No budgets set for FY {selectedYear}</p></div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort().map(([dept, deptBudgets]) => (
            <div key={dept} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">{dept}</h2>
              <div className="space-y-2">
                {deptBudgets.map(b => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[b.budgetType]}`}>{TYPE_LABELS[b.budgetType]}</span>
                    <span className="font-semibold text-gray-900">${b.budgetAmount.toLocaleString()}</span>
                    {b.notes && <span className="text-xs text-gray-400 truncate">{b.notes}</span>}
                    <Button size="sm" variant="ghost" className="ml-auto text-red-500" onClick={() => setDeleteTarget(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">${deptBudgets.reduce((s, b) => s + b.budgetAmount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Budget</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600 flex gap-1"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Department *</Label>
              <Select value={form.department} onValueChange={v => setForm(p => ({ ...p, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{DEPTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Budget Type</Label>
              <Select value={form.budgetType} onValueChange={v => setForm(p => ({ ...p, budgetType: v as BudgetType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUDGET_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Amount (USD) *</Label><Input type="number" min={0} value={form.budgetAmount || ''} onChange={e => setForm(p => ({ ...p, budgetAmount: Number(e.target.value) }))} placeholder="e.g. 500000" /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Budget?</AlertDialogTitle><AlertDialogDescription>Remove this budget entry?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { try { await del.mutateAsync(deleteTarget!.id); setDeleteTarget(null); } catch { toast.error('Failed to delete budget entry.'); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
