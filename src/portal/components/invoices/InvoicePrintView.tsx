import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Invoice, Client } from '../../types';

interface InvoicePrintViewProps {
  invoice: Invoice;
  client: Client | undefined;
}

export function InvoicePrintView({ invoice, client }: InvoicePrintViewProps) {
  return (
    <div>
      <div className="portal-no-print flex justify-end mb-4">
        <Button variant="outline" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print Invoice
        </Button>
      </div>

      <div className="bg-white p-8 rounded-lg border max-w-3xl mx-auto" id="invoice-print">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-lg text-blue-600 font-semibold mt-1">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">Jobly Solutions</p>
            <p className="text-sm text-gray-500">Workforce Management</p>
            <p className="text-sm text-gray-500">billing@joblysolutions.com</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Bill To / Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{client?.companyName ?? invoice.clientId}</p>
            <p className="text-sm text-gray-600">{client?.contactName}</p>
            <p className="text-sm text-gray-600">{client?.contactEmail}</p>
            {client && (
              <p className="text-sm text-gray-600">
                {client.address.city}, {client.address.state} {client.address.zip}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Issue Date:</span>
                <span className="font-medium">{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Due Date:</span>
                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-semibold capitalize ${
                  invoice.status === 'paid' ? 'text-green-600' :
                  invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'
                }`}>{invoice.status.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-gray-50 border-y">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Hours</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Rate</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 px-3 text-gray-700">{item.description}</td>
                <td className="py-3 px-3 text-right text-gray-700">{item.hours}</td>
                <td className="py-3 px-3 text-right text-gray-700">${item.billRate}/hr</td>
                <td className="py-3 px-3 text-right font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-56 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({(invoice.taxRate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAt && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid on</span>
                <span>{formatDate(invoice.paidAt)}</span>
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t text-center text-xs text-gray-400">
          Thank you for your business. Payment is due within {client?.netPaymentDays ?? 30} days.
        </div>
      </div>
    </div>
  );
}
