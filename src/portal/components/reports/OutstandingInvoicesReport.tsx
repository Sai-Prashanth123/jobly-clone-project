import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Download } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency, formatDate } from '../../lib/utils';
import { exportToCsv } from '../../lib/exportCsv';

const OUTSTANDING_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];
const PAGE_SIZE = 10;

function agingBucket(days: number): string {
  if (days <= 0) return 'Current';
  if (days <= 30) return '1–30 days';
  if (days <= 60) return '31–60 days';
  if (days <= 90) return '61–90 days';
  return '90+ days';
}

function agingColor(bucket: string): string {
  if (bucket === 'Current') return 'text-emerald-700 bg-emerald-50';
  if (bucket === '1–30 days') return 'text-yellow-700 bg-yellow-50';
  if (bucket === '31–60 days') return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function rowBg(bucket: string): string {
  if (bucket === '61–90 days') return 'bg-orange-50/40';
  if (bucket === '90+ days') return 'bg-red-50/50';
  return '';
}

const todayMs = () => Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

export function OutstandingInvoicesReport() {
  const { data: invoicesData, isLoading } = useInvoices({ limit: 500 });
  const { data: clientsData } = useClients({ limit: 200 });
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const clients = clientsData?.data ?? [];
  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.companyName])), [clients]);

  const rows = useMemo(() => {
    const today = todayMs();
    return (invoicesData?.data ?? [])
      .filter(inv => OUTSTANDING_STATUSES.includes(inv.status))
      .map(inv => {
        const balance = inv.balanceDue ?? Math.max(0, inv.totalAmount - (inv.amountPaid ?? 0));
        const dueMs = inv.dueDate ? Date.UTC(...(inv.dueDate.split('-').map(Number) as [number, number, number])) : today;
        const daysOverdue = Math.floor((today - dueMs) / 86_400_000);
        const bucket = agingBucket(daysOverdue);
        return { ...inv, balance, daysOverdue, bucket, clientName: clientMap[inv.clientId] ?? '—' };
      })
      .filter(r => {
        if (clientFilter !== 'all' && r.clientId !== clientFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!r.invoiceNumber?.toLowerCase().includes(q) && !r.clientName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoicesData, clientMap, clientFilter, statusFilter, search]);

  const buckets = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {
      'Current': { count: 0, total: 0 }, '1–30 days': { count: 0, total: 0 },
      '31–60 days': { count: 0, total: 0 }, '61–90 days': { count: 0, total: 0 }, '90+ days': { count: 0, total: 0 },
    };
    for (const r of rows) {
      counts[r.bucket].count++;
      counts[r.bucket].total += r.balance;
    }
    return counts;
  }, [rows]);

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  const visible = rows.slice(0, page * PAGE_SIZE);

  const handleExport = () => exportToCsv('outstanding-invoices', rows.map(r => ({
    'Invoice #': r.invoiceNumber, Client: r.clientName, 'Issue Date': r.issueDate,
    'Due Date': r.dueDate ?? '—', Balance: r.balance, 'Days Overdue': r.daysOverdue,
    Status: r.status, Aging: r.bucket,
  })));

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Aging Bucket KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(buckets).map(([label, { count, total }]) => (
          <Card key={label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setClientFilter('all')}>
            <CardContent className="pt-3 pb-3 text-center">
              <p className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-1 ${agingColor(label)}`}>{label}</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input placeholder="Search invoice # or client…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {OUTSTANDING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 ml-auto" onClick={handleExport} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">{rows.length} outstanding invoice{rows.length !== 1 ? 's' : ''}</p>
        <p className="text-sm font-semibold">Total outstanding: <span className="text-red-600">{formatCurrency(totalOutstanding)}</span></p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-2 pb-2 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No outstanding invoices match the current filters.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Balance Due', 'Aging', 'Status'].map(h => (
                      <th key={h} className="pb-2 pt-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className={`border-t border-gray-100 ${rowBg(r.bucket)}`}>
                      <td className="py-2 pr-4 font-mono text-blue-600 whitespace-nowrap">{r.invoiceNumber}</td>
                      <td className="py-2 pr-4 max-w-[160px] truncate">{r.clientName}</td>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{formatDate(r.issueDate)}</td>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                      <td className="py-2 pr-4 font-semibold whitespace-nowrap">{formatCurrency(r.balance)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agingColor(r.bucket)}`}>{r.bucket}</span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > visible.length && (
                <div className="pt-3 pb-1 text-center">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                    Show more ({rows.length - visible.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
