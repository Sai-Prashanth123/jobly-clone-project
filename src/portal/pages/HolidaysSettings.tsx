import { useState } from 'react';
import { Calendar, Plus, Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday, type Holiday } from '../hooks/useHolidays';
import { format } from 'date-fns';

const EMPTY: Omit<Holiday,'id'> = { name: '', date: '', isRecurring: false, countryCode: 'US' };

export default function HolidaysSettings() {
  const year = new Date().getFullYear();
  const { data: holidays = [], isLoading, isError, refetch } = useHolidays(year);
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const del = useDeleteHoliday();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<Omit<Holiday,'id'>>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setOpen(true); };
  const openEdit = (h: Holiday) => { setEditing(h); setForm({ name: h.name, date: h.date, isRecurring: h.isRecurring, countryCode: h.countryCode }); setError(''); setOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.date) { setError('Name and date are required'); return; }
    setSaving(true); setError('');
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...form });
      else await create.mutateAsync(form);
      setOpen(false);
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> Company Holidays ({year})</h2>
        <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Add Holiday</Button>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load holidays. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white">
              <div>
                <span className="font-medium text-gray-900">{h.name}</span>
                <span className="ml-3 text-sm text-gray-500">{format(new Date(h.date + 'T00:00:00'), 'MMMM d, yyyy')}</span>
                {h.isRecurring && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Recurring</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><Edit2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(h)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {holidays.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No holidays added yet</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editing ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600 flex gap-1"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Date *</Label><UsDateInput value={form.date} onChange={iso => setForm(p => ({ ...p, date: iso }))} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(p => ({ ...p, isRecurring: e.target.checked }))} className="h-4 w-4 rounded" />
              Recurring annually
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Holiday?</AlertDialogTitle><AlertDialogDescription>Remove "{deleteTarget?.name}" from the list?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { await del.mutateAsync(deleteTarget!.id); setDeleteTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
