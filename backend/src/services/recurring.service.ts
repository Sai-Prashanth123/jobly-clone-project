import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import { logActivity } from '../lib/activityLogger';
import { todayUTC, advanceByFrequency } from '../lib/dateUtils';
import { createInvoice, sendInvoice } from './invoices.service';
import type { CreateRecurringInput, UpdateRecurringInput } from '../schemas/recurring.schema';

// Recurring-invoice templates: a schedule that auto-generates invoices. The
// node-cron daily tick calls processDueRecurring(); each template can also be
// run on demand from the UI.

export async function listRecurring() {
  const { data, error } = await supabaseAdmin
    .from('recurring_invoice_templates')
    .select('*, clients(company_name)')
    .order('next_run_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRecurring(id: string) {
  const { data, error } = await supabaseAdmin
    .from('recurring_invoice_templates').select('*, clients(company_name)').eq('id', id).single();
  if (error || !data) throw new NotFoundError('Recurring template not found');
  return data;
}

export async function createRecurring(input: CreateRecurringInput, actorId?: string) {
  const { data, error } = await supabaseAdmin
    .from('recurring_invoice_templates')
    .insert({
      client_id: input.clientId,
      title: input.title ?? null,
      line_items: input.lineItems,
      tax_rate: input.taxRate,
      po_number: input.poNumber ?? null,
      currency: input.currency,
      payment_terms: input.paymentTerms,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      frequency: input.frequency,
      start_date: input.startDate,
      end_mode: input.endMode,
      end_date: input.endDate ?? null,
      max_occurrences: input.maxOccurrences ?? null,
      next_run_date: input.startDate,   // first run on the start date
      auto_send: input.autoSend,
      status: 'active',
      created_by: actorId ?? null,
    })
    .select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'created', 'recurring_invoice', data.id, input.title ?? data.id.slice(0, 8));
  return data;
}

export async function updateRecurring(id: string, input: UpdateRecurringInput, actorId?: string) {
  await getRecurring(id);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.lineItems !== undefined) patch.line_items = input.lineItems;
  if (input.taxRate !== undefined) patch.tax_rate = input.taxRate;
  if (input.poNumber !== undefined) patch.po_number = input.poNumber;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.paymentTerms !== undefined) patch.payment_terms = input.paymentTerms;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.terms !== undefined) patch.terms = input.terms;
  if (input.frequency !== undefined) patch.frequency = input.frequency;
  if (input.endMode !== undefined) patch.end_mode = input.endMode;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.maxOccurrences !== undefined) patch.max_occurrences = input.maxOccurrences;
  if (input.autoSend !== undefined) patch.auto_send = input.autoSend;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabaseAdmin
    .from('recurring_invoice_templates').update(patch).eq('id', id).select().single();
  if (error) throw error;
  logActivity(actorId ?? null, 'updated', 'recurring_invoice', id, data.title ?? id.slice(0, 8));
  return data;
}

export async function deleteRecurring(id: string, actorId?: string) {
  await getRecurring(id);
  const { error } = await supabaseAdmin.from('recurring_invoice_templates').delete().eq('id', id);
  if (error) throw error;
  logActivity(actorId ?? null, 'deleted', 'recurring_invoice', id, id.slice(0, 8));
}

// Generate ONE invoice from a template + advance its schedule. Shared by the
// scheduler and the manual "Run now" button.
export async function runRecurringOnce(template: any, actorId?: string): Promise<string | null> {
  const issueDate = todayUTC();
  const invoice = await createInvoice({
    clientId: template.client_id,
    docType: 'invoice',
    poNumber: template.po_number ?? undefined,
    paymentTerms: template.payment_terms,
    issueDate,
    currency: template.currency,
    taxRate: Number(template.tax_rate) || 0,
    notes: template.notes ?? undefined,
    terms: template.terms ?? undefined,
    lineItems: (template.line_items ?? []).map((li: any) => ({
      itemName: li.itemName ?? null,
      description: li.description ?? null,
      quantity: Number(li.quantity) || 1,
      unitPrice: Number(li.unitPrice) || 0,
    })),
  }, actorId);

  // link + advance
  await supabaseAdmin.from('invoices').update({ recurring_template_id: template.id }).eq('id', invoice.id);

  const occurrences = (template.occurrences_made ?? 0) + 1;
  const nextRun = advanceByFrequency(template.next_run_date, template.frequency);
  let status = template.status;
  if (template.end_mode === 'after_count' && template.max_occurrences && occurrences >= template.max_occurrences) status = 'paused';
  if (template.end_mode === 'on_date' && template.end_date && nextRun > template.end_date) status = 'paused';
  await supabaseAdmin.from('recurring_invoice_templates')
    .update({ occurrences_made: occurrences, next_run_date: nextRun, status })
    .eq('id', template.id);

  if (template.auto_send) {
    try { await sendInvoice(invoice.id); } catch (err) { console.error('[recurring] auto-send failed for', invoice.id, err); }
  }
  return invoice.id;
}

// Called by the scheduler: generate every template whose next_run_date is due.
export async function processDueRecurring(): Promise<number> {
  const today = todayUTC();
  const { data: due } = await supabaseAdmin
    .from('recurring_invoice_templates')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_date', today);
  let made = 0;
  for (const tpl of due ?? []) {
    try { await runRecurringOnce(tpl); made++; }
    catch (err) { console.error('[recurring] generation failed for template', tpl.id, err); }
  }
  if (made > 0) console.log(`[scheduler] generated ${made} recurring invoice(s)`);
  return made;
}
