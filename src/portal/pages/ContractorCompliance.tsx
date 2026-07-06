import { AlertTriangle, AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useContractorCompliance } from '../hooks/useAnalytics';

const RISK_STYLES: Record<string, string> = { ok: 'bg-green-50 border-green-200', warn: 'bg-amber-50 border-amber-200', critical: 'bg-red-50 border-red-200' };

export default function ContractorCompliance() {
  const { data: contractors = [], isLoading, isError, refetch } = useContractorCompliance();
  const critical = contractors.filter((c: any) => c.riskLevel === 'critical');
  const warn = contractors.filter((c: any) => c.riskLevel === 'warn');
  const ok = contractors.filter((c: any) => c.riskLevel === 'ok');

  const Card = ({ c }: { c: any }) => (
    <Link to={`/portal/employees/${c.id}`} className={`block p-4 rounded-xl border ${RISK_STYLES[c.riskLevel]} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{c.first_name} {c.last_name} <span className="text-xs text-gray-400">{c.display_id}</span></p>
          <p className="text-xs text-gray-500">{c.job_title} · {c.employment_type}</p>
          {c.issues.length > 0 && (
            <ul className="mt-2 space-y-0.5">{c.issues.map((issue: string) => <li key={issue} className="flex items-center gap-1 text-xs text-red-700"><AlertTriangle className="h-3 w-3 flex-shrink-0" />{issue}</li>)}</ul>
          )}
        </div>
        <div className="flex-shrink-0">
          {c.riskLevel === 'ok' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertTriangle className={`h-5 w-5 ${c.riskLevel === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-6 w-6 text-amber-500" /> Contractor Compliance</h1>
        <p className="text-sm text-gray-500">{contractors.length} contractors — {critical.length} critical, {warn.length} warnings, {ok.length} compliant</p>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load contractor compliance data.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {critical.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-red-600 mb-3">Critical Issues ({critical.length})</h2><div className="space-y-2">{critical.map((c: any) => <Card key={c.id} c={c} />)}</div></section>}
          {warn.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3">Warnings ({warn.length})</h2><div className="space-y-2">{warn.map((c: any) => <Card key={c.id} c={c} />)}</div></section>}
          {ok.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-green-600 mb-3">Compliant ({ok.length})</h2><div className="space-y-2">{ok.map((c: any) => <Card key={c.id} c={c} />)}</div></section>}
          {contractors.length === 0 && <div className="text-center py-20 text-gray-400"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No active contractors found</p></div>}
        </div>
      )}
    </div>
  );
}
