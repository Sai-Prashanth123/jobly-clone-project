import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';

// Public, unauthenticated invoice view (Wave-style shareable link). Uses a bare
// axios call (NOT the authed apiClient) so no token is attached.
const API_URL = import.meta.env.VITE_API_URL ?? 'https://prashanthreddy-hndndtdfhkdjhwft.eastasia-01.azurewebsites.net/api/v1';

export default function PublicInvoiceView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/public/invoices/${token}`);
      return data.data;
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">Invoice not found</p>
          <p className="text-sm text-muted-foreground mt-1">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const cur = data.currency ?? 'USD';
  const client = data.clients ?? {};
  const isEstimate = data.doc_type === 'estimate';
  const items = data.invoice_line_items ?? [];
  const billTo = [client.billing_street, client.billing_city, client.billing_state, client.billing_zip, client.billing_country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#4069FF] to-[#32CDDC] px-8 py-6 text-white">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-90">Jobly Solutions</p>
          <h1 className="text-2xl font-bold mt-1">{isEstimate ? 'Estimate' : 'Invoice'} {data.invoice_number}</h1>
        </div>

        <div className="px-8 py-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bill to</p>
            <p className="font-medium text-gray-900 mt-1">{client.company_name ?? '—'}</p>
            {client.contact_name && <p className="text-gray-600">{client.contact_name}</p>}
            {billTo && <p className="text-gray-600">{billTo}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Issued {formatDate(data.issue_date)}</p>
            <p className="text-xs text-gray-500">Due {formatDate(data.due_date)}</p>
            {data.po_number && <p className="text-xs text-gray-500">P.O. {data.po_number}</p>}
            <p className="mt-2 inline-block text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
              {(isEstimate ? data.estimate_status : data.status)?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="px-8 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-200">
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-right py-2 w-28">Price</th>
                <th className="text-right py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((li: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">
                    <p className="font-medium text-gray-900">{li.item_name || li.description}</p>
                    {li.item_name && li.description && <p className="text-xs text-gray-500">{li.description}</p>}
                  </td>
                  <td className="text-right tabular-nums">{li.quantity ?? li.hours}</td>
                  <td className="text-right tabular-nums">{formatCurrency(li.bill_rate, cur)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(li.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(data.subtotal, cur)}</span></div>
            {Number(data.discount_amount) > 0 && <div className="flex justify-between text-gray-600"><span>Discount{data.discount_type === 'percentage' && data.discount_value ? ` (${data.discount_value}%)` : ''}</span><span>−{formatCurrency(data.discount_amount, cur)}</span></div>}
            {Number(data.tax_rate) > 0 && <div className="flex justify-between text-gray-600"><span>Tax ({data.tax_rate}%)</span><span>{formatCurrency(data.tax_amount, cur)}</span></div>}
            <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{formatCurrency(data.total_amount, cur)}</span></div>
            {!isEstimate && Number(data.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{formatCurrency(data.amount_paid, cur)}</span></div>
                <div className="flex justify-between font-semibold text-blue-700"><span>Balance due</span><span>{formatCurrency(data.balance_due, cur)}</span></div>
              </>
            )}
          </div>
        </div>

        {(data.notes || data.terms) && (
          <div className="px-8 py-4 border-t border-gray-100 text-sm text-gray-600 space-y-2">
            {data.notes && <p>{data.notes}</p>}
            {data.terms && <p className="text-xs text-gray-500">{data.terms}</p>}
          </div>
        )}

        <div className="px-8 py-4 bg-gray-50 text-center text-xs text-gray-400">
          Powered by Jobly Solutions
        </div>
      </div>
    </div>
  );
}
