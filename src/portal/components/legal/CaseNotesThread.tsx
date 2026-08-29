import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Filter } from 'lucide-react';
import { useAddCaseNote, useTaggableUsers } from '../../hooks/useCases';
import type { CaseNote } from '../../types';

const NOTE_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
const ACCESS_LEVELS = ['Internal', 'Shared'] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US');
}

const ANY = '__any__';

export function CaseNotesThread({ caseId, notes }: { caseId: string; notes: CaseNote[] }) {
  const addNote = useAddCaseNote(caseId);
  const { data: taggableUsers } = useTaggableUsers();
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');
  const [taggedTo, setTaggedTo] = useState('');
  const [status, setStatus] = useState('');
  const [accessLevel, setAccessLevel] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fTaggedTo, setFTaggedTo] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fAccessLevel, setFAccessLevel] = useState('');

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await addNote.mutateAsync({
        body,
        title: title.trim() || undefined,
        taggedTo: taggedTo || undefined,
        status: status || undefined,
        accessLevel: accessLevel || undefined,
      });
      setDraft(''); setTitle(''); setTaggedTo(''); setStatus(''); setAccessLevel('');
    } catch {
      toast.error('Could not add the note. Please try again.');
    }
  };

  const filtered = useMemo(() => {
    return notes.filter(n => {
      if (fTitle && !(n.title ?? '').toLowerCase().includes(fTitle.toLowerCase())) return false;
      if (fTaggedTo && n.taggedTo !== fTaggedTo) return false;
      if (fStatus && n.status !== fStatus) return false;
      if (fAccessLevel && n.accessLevel !== fAccessLevel) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, fTitle, fTaggedTo, fStatus, fAccessLevel]);

  return (
    <div className="space-y-4">
      <div className="space-y-2 border border-gray-100 rounded-lg p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" />
          <Select value={taggedTo || ANY} onValueChange={v => setTaggedTo(v === ANY ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Tagged To" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Unassigned</SelectItem>
              {(taggableUsers ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status || ANY} onValueChange={v => setStatus(v === ANY ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>None</SelectItem>
              {NOTE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accessLevel || ANY} onValueChange={v => setAccessLevel(v === ANY ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Access Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>None</SelectItem>
              {ACCESS_LEVELS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-start gap-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Log an update — e.g. &quot;Called USCIS, case is on hold&quot;…"
            rows={2}
            maxLength={2000}
            className="resize-y"
          />
          <Button size="sm" onClick={handleAdd} disabled={!draft.trim()} loading={addNote.isPending}>
            Add Note
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{filtered.length} of {notes.length} notes</p>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowFilters(s => !s)}>
          <Filter className="h-3.5 w-3.5" /> Filters
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-gray-50 rounded-lg p-3">
          <Input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Search by title" className="bg-white" />
          <Select value={fTaggedTo || ANY} onValueChange={v => setFTaggedTo(v === ANY ? '' : v)}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Tagged To" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All</SelectItem>
              {(taggableUsers ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus || ANY} onValueChange={v => setFStatus(v === ANY ? '' : v)}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All</SelectItem>
              {NOTE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fAccessLevel || ANY} onValueChange={v => setFAccessLevel(v === ANY ? '' : v)}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Access Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All</SelectItem>
              {ACCESS_LEVELS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
          <MessageSquare className="h-8 w-8 text-gray-300" />
          <p className="text-sm">No notes match.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {filtered.map(note => (
            <div key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              {note.title && <p className="text-sm font-medium text-gray-900">{note.title}</p>}
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{note.body}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {note.status && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{note.status}</span>}
                {note.accessLevel && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700">{note.accessLevel}</span>}
                {note.taggedToName && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">→ {note.taggedToName}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {note.authorName ?? 'Unknown'} · {timeAgo(note.createdAt)}
                {note.editedAt && ' · edited'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
