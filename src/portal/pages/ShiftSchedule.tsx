import { useState } from 'react';
import { Calendar, Plus, Trash2, Edit2, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, subWeeks, startOfWeek, addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift, SHIFT_COLORS, type ShiftType, type Shift } from '../hooks/useShifts';
import { useEmployees } from '../hooks/useEmployees';

const SHIFT_TYPES: ShiftType[] = ['morning','afternoon','evening','night','flexible'];
const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function ShiftSchedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: shifts = [], isLoading, isError, refetch } = useShifts({ startDate, endDate });
  const { data: empResult } = useEmployees();
  const employees = empResult?.data ?? [];
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState({ employeeId: '', date: startDate, startTime: '09:00', endTime: '17:00', shiftType: 'morning' as ShiftType, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeEmp = employees.filter(e => e.status === 'active');

  const openCreate = () => { setEditing(null); setForm({ employeeId: '', date: startDate, startTime: '09:00', endTime: '17:00', shiftType: 'morning', notes: '' }); setError(''); setOpen(true); };
  const openEdit = (s: Shift) => { setEditing(s); setForm({ employeeId: s.employeeId, date: s.date, startTime: s.startTime, endTime: s.endTime, shiftType: s.shiftType, notes: s.notes ?? '' }); setError(''); setOpen(true); };

  const handleSave = async () => {
    if (!form.employeeId || !form.date) { setError('Employee and date required'); return; }
    setSaving(true); setError('');
    try {
      if (editing) await updateShift.mutateAsync({ id: editing.id, ...form });
      else await createShift.mutateAsync(form);
      setOpen(false);
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
    finally { setSaving(false); }
  };

  // Group shifts by employee for the week grid
  const shiftsByEmpDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.employeeId}::${s.date}`;
    if (!shiftsByEmpDate.has(key)) shiftsByEmpDate.set(key, []);
    shiftsByEmpDate.get(key)!.push(s);
  }
  const empIds = [...new Set(shifts.map(s => s.employeeId))];
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="h-6 w-6 text-blue-600" /> Shift Schedule</h1><p className="text-sm text-gray-500">Weekly roster view</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => subWeeks(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(d => addWeeks(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" onClick={openCreate} className="gap-1 ml-2"><Plus className="h-4 w-4" /> Add Shift</Button>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load shifts. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-36">Employee</th>
                {weekDays.map((d, i) => <th key={d} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 min-w-[100px]"><div>{WEEK_DAYS[i]}</div><div className="text-gray-400 font-normal">{format(addDays(weekStart, i), 'MMM d')}</div></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empIds.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No shifts scheduled this week</td></tr>
              ) : empIds.map(empId => {
                const emp = employees.find(e => e.id === empId);
                return (
                  <tr key={empId} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900 text-xs">{emp ? `${emp.firstName} ${emp.lastName}` : empId}</p>
                      {emp?.department && <p className="text-xs text-gray-400">{emp.department}</p>}
                    </td>
                    {weekDays.map(d => {
                      const dayShifts = shiftsByEmpDate.get(`${empId}::${d}`) ?? [];
                      return (
                        <td key={d} className="px-1 py-1 align-top">
                          {dayShifts.map(s => (
                            <div key={s.id} className={`text-xs px-1.5 py-1 rounded mb-0.5 flex items-center justify-between gap-1 ${SHIFT_COLORS[s.shiftType]}`}>
                              <span>{s.startTime.slice(0,5)}–{s.endTime.slice(0,5)}</span>
                              <div className="flex gap-0.5">
                                <button onClick={() => openEdit(s)} className="hover:opacity-70"><Edit2 className="h-2.5 w-2.5" /></button>
                                <button onClick={() => setDeleteTarget(s)} className="hover:opacity-70"><Trash2 className="h-2.5 w-2.5" /></button>
                              </div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-md" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editing ? 'Edit Shift' : 'Add Shift'}</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-red-600 flex gap-1"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Employee *</Label>
              <Select value={form.employeeId} onValueChange={v => setForm(p => ({ ...p, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{activeEmp.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date *</Label><UsDateInput value={form.date} onChange={iso => setForm(p => ({ ...p, date: iso }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start Time</Label><Input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} /></div>
              <div className="space-y-1"><Label>End Time</Label><Input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Shift Type</Label>
              <Select value={form.shiftType} onValueChange={v => setForm(p => ({ ...p, shiftType: v as ShiftType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
            <AlertDialogDescription>Remove this shift for {deleteTarget && employees.find(e => e.id === deleteTarget.employeeId)?.firstName}? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { deleteShift.mutate(deleteTarget!.id); setDeleteTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
