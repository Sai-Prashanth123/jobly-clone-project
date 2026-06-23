import { Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProbation } from '../hooks/useAnalytics';
import { format } from 'date-fns';

export default function ProbationTracker() {
  const { data: employees = [], isLoading } = useProbation();
  const overdue = employees.filter(e => e.isOverdue);
  const dueSoon = employees.filter(e => !e.isOverdue && e.daysLeft !== null && e.daysLeft <= 30);
  const normal = employees.filter(e => !e.isOverdue && (e.daysLeft === null || e.daysLeft > 30));

  const Card = ({ e }: { e: any }) => (
    <Link to={`/portal/employees/${e.id}`} className="block p-3 rounded-xl border hover:shadow-md transition-shadow bg-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{e.first_name} {e.last_name} <span className="text-xs text-gray-400">{e.display_id}</span></p>
          <p className="text-xs text-gray-500">{e.job_title} · {e.department}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {e.isOverdue ? (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Overdue</span>
          ) : e.daysLeft !== null ? (
            <span className={`text-xs font-semibold ${e.daysLeft <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>{e.daysLeft}d left</span>
          ) : null}
          {e.probation_end_date && <p className="text-xs text-gray-400 mt-0.5">Ends {format(new Date(e.probation_end_date + 'T00:00:00Z'), 'MMM d, yyyy')}</p>}
        </div>
      </div>
    </Link>
  );

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Clock className="h-6 w-6 text-amber-500" /> Probation Tracker</h1>
        <p className="text-sm text-gray-500">{employees.length} employees with active probation periods</p>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-20 text-gray-400"><Clock className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No employees with probation dates set</p></div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-red-600 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Overdue ({overdue.length})</h2><div className="space-y-2">{overdue.map(e => <Card key={e.id} e={e} />)}</div></section>}
          {dueSoon.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Due Soon — 30 days ({dueSoon.length})</h2><div className="space-y-2">{dueSoon.map(e => <Card key={e.id} e={e} />)}</div></section>}
          {normal.length > 0 && <section><h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Active ({normal.length})</h2><div className="space-y-2">{normal.map(e => <Card key={e.id} e={e} />)}</div></section>}
        </div>
      )}
    </div>
  );
}
