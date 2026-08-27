import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailField as Field } from '../components/shared/DetailField';
import { useSupportTicket, useResolveSupportTicket } from '../hooks/useSupportTickets';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ticket, isLoading, isError } = useSupportTicket(id);
  const resolveTicket = useResolveSupportTicket(id ?? '');
  const [resolution, setResolution] = useState('');

  const canResolve = user?.role === 'admin' || user?.role === 'legal';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Could not load this ticket.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/portal/support-tickets')}>Back to Support Tickets</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/portal/support-tickets')} className="gap-1 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{ticket.subject}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          <span className="text-xs font-mono text-blue-600">{ticket.displayId}</span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Request</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Raised By" value={ticket.createdByName} />
            <Field label="Raised On" value={formatDate(ticket.createdAt)} />
            {ticket.caseDisplayId && <Field label="About Case" value={ticket.caseDisplayId} />}
            {ticket.employeeFirstName && (
              <Field label="About Employee" value={`${ticket.employeeFirstName} ${ticket.employeeLastName ?? ''}`.trim()} />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Message</p>
            <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap break-words">{ticket.message}</p>
          </div>
        </CardContent>
      </Card>

      {ticket.status === 'resolved' ? (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Resolution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{ticket.resolution}</p>
            <p className="text-xs text-muted-foreground">
              Resolved by {ticket.resolvedByName ?? 'Legal'}{ticket.resolvedAt && ` on ${formatDate(ticket.resolvedAt)}`}
            </p>
          </CardContent>
        </Card>
      ) : canResolve ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Resolve</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="How was this resolved?"
              rows={3}
              className="resize-y"
            />
            <div className="flex justify-end">
              <Button
                disabled={!resolution.trim()}
                loading={resolveTicket.isPending}
                loadingText="Resolving…"
                onClick={async () => {
                  try {
                    await resolveTicket.mutateAsync(resolution.trim());
                    toast.success('Ticket resolved');
                  } catch {
                    toast.error('Could not resolve the ticket. Please try again.');
                  }
                }}
              >
                Mark Resolved
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-400">
            Waiting on Legal to respond.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
