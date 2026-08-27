import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';
import { useAddCaseNote } from '../../hooks/useCases';
import type { CaseNote } from '../../types';

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

export function CaseNotesThread({ caseId, notes }: { caseId: string; notes: CaseNote[] }) {
  const addNote = useAddCaseNote(caseId);
  const [draft, setDraft] = useState('');

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await addNote.mutateAsync(body);
      setDraft('');
    } catch {
      toast.error('Could not add the note. Please try again.');
    }
  };

  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
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

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
          <MessageSquare className="h-8 w-8 text-gray-300" />
          <p className="text-sm">No notes yet.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {sorted.map(note => (
            <div key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{note.body}</p>
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
