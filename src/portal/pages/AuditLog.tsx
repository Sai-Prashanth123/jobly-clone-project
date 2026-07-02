import { useState } from 'react';
import { Shield, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuditLog } from '../hooks/useAnalytics';
import { UsDateInput } from '../components/shared/UsDateInput';
import { format } from 'date-fns';

const ACTIONS = ['created','updated','deleted','status_changed','sent','uploaded_client_proof','downloaded_pdf','requested_changes','reopened'];
const ACTION_COLORS: Record<string, string> = { created:'bg-green-100 text-green-700', updated:'bg-blue-100 text-blue-700', deleted:'bg-red-100 text-red-700', status_changed:'bg-amber-100 text-amber-700' };

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('_all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useAuditLog({ page, limit: 50, search: search || undefined, action: (action && action !== '_all') ? action : undefined, startDate: startDate || undefined, endDate: endDate || undefined });
  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">All system activity — {total.toLocaleString()} entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search entity label…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={action} onValueChange={v => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All actions</SelectItem>
            {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <UsDateInput className="w-40" value={startDate} onChange={iso => { setStartDate(iso); setPage(1); }} />
        <UsDateInput className="w-40" value={endDate} onChange={iso => { setEndDate(iso); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Shield className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No logs found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Time','Actor','Action','Entity Type','Label'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.actor?.name ?? 'System'}</div>
                      <div className="text-xs text-gray-400 capitalize">{log.actor?.role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.entity_type}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.entity_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
