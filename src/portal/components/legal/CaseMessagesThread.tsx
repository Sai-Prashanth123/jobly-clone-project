import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Check } from 'lucide-react';
import { useCaseMessages, useCreateCaseMessage, useMarkMessageRead } from '../../hooks/useCases';
import { formatDate } from '../../lib/utils';

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All Users',
  law_firm: 'Admin/HR (Internal)',
  beneficiary: 'Beneficiary',
};

interface CaseMessagesThreadProps {
  caseId: string;
  // Employee-facing view (CaseMessages.tsx): there's no "audience" concept
  // from the employee's side — their reply is always to the case-handling
  // team, so hide the picker and force it server-side instead (see
  // caseMessages.service.ts's createMessage). Legal/admin/hr keep the full
  // picker via Case Detail's Messages tab (the default, unset here).
  hideAudiencePicker?: boolean;
}

export function CaseMessagesThread({ caseId, hideAudiencePicker = false }: CaseMessagesThreadProps) {
  const { data: messages, isLoading } = useCaseMessages(caseId);
  const createMessage = useCreateCaseMessage(caseId);
  const markRead = useMarkMessageRead(caseId);
  const [draft, setDraft] = useState('');
  const [audience, setAudience] = useState<'all' | 'law_firm' | 'beneficiary'>('all');

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await createMessage.mutateAsync({ body, audience: hideAudiencePicker ? 'law_firm' : audience });
      setDraft('');
    } catch {
      toast.error('Could not send the message. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={hideAudiencePicker ? 'Write a reply…' : 'Insert text here…'}
          rows={3}
          maxLength={4000}
          className="resize-y"
        />
        <div className="flex items-center justify-end gap-3">
          {!hideAudiencePicker && (
            <div className="w-44 mr-auto">
              <Select value={audience} onValueChange={v => setAudience(v as typeof audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button size="sm" onClick={send} disabled={!draft.trim()} loading={createMessage.isPending}>
            Submit
          </Button>
        </div>
      </div>

      {isLoading ? null : !messages?.length ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
          <MessageCircle className="h-8 w-8 text-gray-300" />
          <p className="text-sm">No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(m => (
            <div key={m.id} className="rounded-lg border border-gray-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sent By {m.authorName ?? 'Unknown'} On {formatDate(m.createdAt)}
                    {!hideAudiencePicker && ` · ${AUDIENCE_LABELS[m.audience]}`}
                  </p>
                </div>
                {!m.read && (
                  <Button
                    variant="outline" size="sm" className="gap-1.5 flex-shrink-0"
                    loading={markRead.isPending}
                    onClick={() => markRead.mutate(m.id)}
                  >
                    <Check className="h-3.5 w-3.5" /> Mark as Read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
