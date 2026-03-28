import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInvoices } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../lib/utils';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BillingChart() {
  const { data: invData } = useInvoices({ limit: 500 });
  const { data: clientData } = useClients({ limit: 200 });

  const invoices = invData?.data ?? [];
  const clients = clientData?.data ?? [];

  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const topClients = clients.filter(c => c.status === 'active').slice(0, 4);

  const data = months.map(month => {
    const row: Record<string, string | number> = {
      month: MONTH_LABELS[parseInt(month.split('-')[1]) - 1],
    };
    topClients.forEach(client => {
      const total = invoices
        .filter(inv => inv.clientId === client.id && inv.issueDate.startsWith(month))
        .reduce((s, inv) => s + inv.totalAmount, 0);
      row[client.companyName.split(' ')[0]] = total;
    });
    return row;
  });

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue by Client — Last 6 Months</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {topClients.map((client, i) => (
              <Line
                key={client.id}
                type="monotone"
                dataKey={client.companyName.split(' ')[0]}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
