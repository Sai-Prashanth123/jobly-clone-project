import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePortalData } from '../../hooks/usePortalData';
import { formatCurrency } from '../../lib/utils';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FinancialChart() {
  const { invoices } = usePortalData();

  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const data = months.map(month => {
    const label = MONTH_LABELS[parseInt(month.split('-')[1]) - 1];
    const monthInvoices = invoices.filter(i => i.issueDate.startsWith(month));
    const invoiced = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid = monthInvoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + i.totalAmount, 0);
    return { month: label, Invoiced: invoiced, Paid: paid };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invoiced vs Paid — Last 6 Months</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Invoiced" stroke="#3b82f6" fill="url(#colorInvoiced)" strokeWidth={2} />
            <Area type="monotone" dataKey="Paid" stroke="#10b981" fill="url(#colorPaid)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
