import { useState } from 'react';
import { Zap, Search, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSkillSearch } from '../hooks/useSkills';
import { useEmployees } from '../hooks/useEmployees';
import { useEmployeeSkills, useAddSkill, useDeleteSkill, PROF_COLORS, type Proficiency } from '../hooks/useSkills';

const PROFICIENCIES: Proficiency[] = ['beginner','intermediate','advanced','expert'];

function EmployeeSkillsPanel({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { data: skills = [], isLoading } = useEmployeeSkills(employeeId);
  const addSkill = useAddSkill();
  const deleteSkill = useDeleteSkill();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ skillName: '', proficiency: 'intermediate' as Proficiency, lastUsedYear: '' });
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!form.skillName) { setError('Skill name required'); return; }
    setError('');
    try {
      await addSkill.mutateAsync({ employeeId, skillName: form.skillName, proficiency: form.proficiency, lastUsedYear: form.lastUsedYear ? Number(form.lastUsedYear) : undefined });
      setOpen(false); setForm({ skillName: '', proficiency: 'intermediate', lastUsedYear: '' });
    } catch (e: any) { setError(e?.response?.data?.error ?? 'Failed'); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-gray-900">{employeeName}</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Skill</Button>
      </div>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
        <div className="flex flex-wrap gap-1.5">
          {skills.length === 0 && <p className="text-xs text-gray-400">No skills added</p>}
          {skills.map(s => (
            <span key={s.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${PROF_COLORS[s.proficiency]}`}>
              {s.skillName} · {s.proficiency}
              <button onClick={() => deleteSkill.mutate({ id: s.id, employeeId })} className="ml-1 hover:opacity-70"><Trash2 className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader><DialogTitle>Add Skill for {employeeName}</DialogTitle></DialogHeader>
          {error && <p className="text-xs text-red-600 flex gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label>Skill Name</Label><Input value={form.skillName} onChange={e => setForm(p => ({ ...p, skillName: e.target.value }))} placeholder="e.g. Python" /></div>
            <div className="space-y-1"><Label>Proficiency</Label>
              <Select value={form.proficiency} onValueChange={v => setForm(p => ({ ...p, proficiency: v as Proficiency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROFICIENCIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Last Used Year (optional)</Label><Input type="number" value={form.lastUsedYear} onChange={e => setForm(p => ({ ...p, lastUsedYear: e.target.value }))} placeholder={String(new Date().getFullYear())} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSkill.isPending}>{addSkill.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SkillsRegistry() {
  const [search, setSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const { data: empResult } = useEmployees();
  const employees = empResult?.data ?? [];
  const { data: skillResults = [], isLoading: searching } = useSkillSearch(search);

  const activeEmp = employees.filter(e => e.status === 'active');
  const filtered = empSearch ? activeEmp.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(empSearch.toLowerCase())) : activeEmp.slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Zap className="h-6 w-6 text-amber-500" /> Skills Registry</h1>
        <p className="text-sm text-gray-500">Search who has what skills, or browse by employee</p>
      </div>

      {/* Skill search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Search by Skill</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="e.g. Python, React, Excel…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {search.length >= 2 && !searching && (
          <div className="space-y-1.5">
            {skillResults.length === 0 ? <p className="text-sm text-gray-400">No results</p> : skillResults.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="font-medium text-gray-900 text-sm">{s.employeeName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PROF_COLORS[s.proficiency]}`}>{s.skillName} · {s.proficiency}</span>
                {s.employeeDept && <span className="text-xs text-gray-400 ml-auto">{s.employeeDept}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-employee panels */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Filter employees…" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
        </div>
        <div className="space-y-3">
          {filtered.map(e => (
            <EmployeeSkillsPanel key={e.id} employeeId={e.id} employeeName={`${e.firstName} ${e.lastName}`} />
          ))}
          {!empSearch && activeEmp.length > 10 && <p className="text-xs text-gray-400 text-center">Search to see more employees</p>}
        </div>
      </div>
    </div>
  );
}
