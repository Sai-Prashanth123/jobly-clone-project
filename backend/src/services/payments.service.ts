import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ValidationError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import type { CreatePaymentInput } from '../schemas/payment.schema';

// Manual payment recording (no processor). Each payment is a row; the invoice's
// amount_paid = Σ payments, and its status is recomputed: paid (≥ total),
// partially_paid (>0 & < total), else left at its sent/overdue/draft state.

function round2(n: number): number { return Math.round(n * 100) / 100; }

export async function listPayments(invoiceId: string) {
  const { data, error } = await supabaseAdmin
    .from('payments').select('*').eq('invoice_id', invoiceId).order('paid_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Recompute amount_paid + status from the payment rows and persist on the invoice.
async function reconcileInvoice(invoiceId: string): Promise<void> {
  const { data: inv } = await supabaseAdmin
    .from('invoices').select('id, total_amount, status, doc_type').eq('id', invoiceId).single();
  if (!inv) return;
  const { data: pays } = await supabaseAdmin.from('payments').select('amount').eq('invoice_id', invoiceId);
  const paid = round2((pays ?? []).reduce((s, p) => s + Number(p.amount), 0));
  const total = Number(inv.total_amount) || 0;

  const patch: Record<string, unknown> = { amount_paid: paid };
  if (paid >= total && total > 0) {
    patch.status = 'paid';
    patch.paid_at = new Date().toISOString();
  } else if (paid > 0) {
    patch.status = 'partially_paid';
    patch.paid_at = null;
  } else {
    // No payments left — fall back to overdue if past due, else sent (don't
    // resurrect a draft).
    if (inv.status === 'paid' || inv.status === 'partially_paid') patch.status = 'sent';
    patch.paid_at = null;
  }
  await supabaseAdmin.from('invoices').update(patch).eq('id', invoiceId);
}

export async function recordPayment(invoiceId: string, input: CreatePaymentInput, actorId?: string) {
  const { data: inv } = await supabaseAdmin
    .from('invoices').select('id, invoice_number, total_amount, amount_paid, doc_type').eq('id', invoiceId).single();
  if (!inv) throw new NotFoundError('Invoice not found');
  if (inv.doc_type === 'estimate') throw new ValidationError('Payments cannot be recorded against an estimate.');

  const total = Number(inv.total_amount) || 0;
  const already = Number(inv.amount_paid) || 0;
  if (round2(already + input.amount) > round2(total) + 0.01) {
    throw new ValidationError(
      `Payment exceeds the balance due. Balance is ${round2(total - already)}; you entered ${input.amount}.`,
    );
  }

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount: input.amount,
      paid_on: input.paidOn,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      created_by: actorId ?? null,
    })
    .select().single();
  if (error) throw error;

  await reconcileInvoice(invoiceId);
  logActivity(actorId ?? null, 'created', 'payment', payment.id, inv.invoice_number ?? invoiceId.slice(0, 8),
    { amount: input.amount, method: input.method });
  return payment;
}

export async function deletePayment(paymentId: string, actorId?: string) {
  const { data: payment } = await supabaseAdmin
    .from('payments').select('id, invoice_id, amount').eq('id', paymentId).maybeSingle();
  if (!payment) throw new NotFoundError('Payment not found');
  const { error } = await supabaseAdmin.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
  await reconcileInvoice(payment.invoice_id);
  logActivity(actorId ?? null, 'deleted', 'payment', paymentId, paymentId.slice(0, 8));
}
