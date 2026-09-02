import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, FolderOpen, Clock, ShieldAlert, Inbox, AlertCircle, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '../../components/shared/StatCard';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { QuickActions } from '../../components/shared/QuickActions';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { Panel } from '../../components/shared/Panel';
import { formatDate } from '../../lib/utils';
import { useCases } from '../../hooks/useCases';
import { useSupportTickets } from '../../hooks/useSupportTickets';
import { CASE_TYPE_LABELS } from '../../components/legal/CaseForm';

// Cases still awaiting action — everything except a terminal state.
const OPEN_CASE_STATUSES = new Set(['open', 'pending_uscis', 'rfe_received']);

export function LegalDashboard() {
  const { data: caseData, isError, refetch } = useCases({ limit: 500 });
  const { data: ticketData } = useSupportTickets({ limit: 200 });

  const cases = useMemo(() => caseData?.data ?? [], [caseData]);
  const tickets = useMemo(() => ticketData?.data ?? [], [ticketData]);

  const openCases = useMemo(() => cases.filter(c => OPEN_CASE_STATUSES.has(c.status)), [cases]);
  const pendingUscis = useMemo(() => cases.filter(c => c.status === 'pending_uscis'), [cases]);
  const rfeReceived = useMemo(() => cases.filter(c => c.status === 'rfe_received'), [cases]);
  const openTickets = useMemo(() => tickets.filter(t => t.status !== 'resolved'), [tickets]);

  const recentOpenCases = useMemo(
    () => [...openCases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [openCases],
  );
  const recentOpenTickets = useMemo(
    () => [...openTickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [openTickets],
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-500">Failed to load dashboard data.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="Legal"
        title="Cases Overview"
        subtitle="Cases and support tickets raised to Legal."
      />

      <QuickActions
        actions={[
          { label: 'View Cases', to: '/portal/cases', icon: Gavel, tone: 'blue' },
          { label: 'Support Tickets', to: '/portal/support-tickets', icon: LifeBuoy, tone: 'cyan' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Open Cases', value: openCases.length, icon: <FolderOpen className="h-5 w-5" />, variant: 'blue' as const, to: '/portal/cases', linkLabel: 'View cases' },
          { title: 'Pending USCIS', value: pendingUscis.length, icon: <Clock className="h-5 w-5" />, variant: 'orange' as const, to: '/portal/cases', linkLabel: 'View cases' },
          { title: 'RFE Received', value: rfeReceived.length, icon: <ShieldAlert className="h-5 w-5" />, variant: 'red' as const, description: 'Needs a response', to: '/portal/cases', linkLabel: 'View cases' },
          { title: 'Open Tickets', value: openTickets.length, icon: <Inbox className="h-5 w-5" />, variant: 'green' as const, to: '/portal/support-tickets', linkLabel: 'View tickets' },
        ].map((c, i) => (
          <div key={c.title} className="portal-stagger" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      <Panel
        eyebrow="Needs attention"
        title={`Open Cases (${openCases.length})`}
        icon={<Gavel className="text-[#4069FF]" />}
        action={openCases.length > 0 ? { label: 'All cases', to: '/portal/cases' } : undefined}
        flush={recentOpenCases.length > 0}
      >
        {recentOpenCases.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Inbox className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-muted-foreground">No open cases. All caught up.</p>
          </div>
        ) : (
          <div>
            {recentOpenCases.map(c => (
              <Link key={c.id} to={`/portal/cases/${c.id}`} className="portal-data-row">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b1220] truncate">
                    {c.displayId} — {c.employeeFirstName} {c.employeeLastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CASE_TYPE_LABELS[c.caseType] ?? c.caseType}
                    {c.receiptNumber && ` · ${c.receiptNumber}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        eyebrow="Requests"
        title={`Open Support Tickets (${openTickets.length})`}
        icon={<LifeBuoy className="text-emerald-500" />}
        action={openTickets.length > 0 ? { label: 'All tickets', to: '/portal/support-tickets' } : undefined}
        flush={recentOpenTickets.length > 0}
      >
        {recentOpenTickets.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Inbox className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-muted-foreground">No open tickets.</p>
          </div>
        ) : (
          <div>
            {recentOpenTickets.map(t => (
              <Link key={t.id} to={`/portal/support-tickets/${t.id}`} className="portal-data-row">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b1220] truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.employeeFirstName ? `${t.employeeFirstName} ${t.employeeLastName}` : t.caseDisplayId ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
