import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseMessagesThread } from '../components/legal/CaseMessagesThread';
import { isValidId } from '../lib/utils';

// Employee-facing view of a single case's message thread — reached only via
// the "New message on your case" notification link (no permanent sidebar
// entry, since not every employee has a case). Deliberately doesn't fetch
// the case itself (GET /cases/:id stays admin/hr/legal-only) — the messages
// endpoint is the one case sub-resource an employee can reach, scoped to
// their own case by caseMessages.service.ts.
export default function CaseMessages() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/portal/notifications')} className="gap-1 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold truncate">Case Messages</h1>
          <p className="text-sm text-muted-foreground truncate">
            Messages from the team handling your case — reply here if you have questions or need to send a document.
          </p>
        </div>
      </div>

      {isValidId(caseId) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
          <CardContent>
            <CaseMessagesThread caseId={caseId} hideAudiencePicker />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">This link is missing a case reference.</p>
      )}
    </div>
  );
}
