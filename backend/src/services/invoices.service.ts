import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../lib/errors';
import { generateInvoicePDF, type InvoicePDFData } from '../lib/pdfGenerator';
import { logActivity } from '../lib/activityLogger';
import { sendInvoiceEmail, mailerConfigured } from '../lib/mailer';
import { createNotification, getUserIdsByRole } from './notifications.service';
import { uploadDocument, deleteDocument } from './storage.service';
import { getInvoiceTheme } from './invoiceTemplates.service';
import { addDaysToDate, todayUTC } from '../lib/dateUtils';
import type { GenerateInvoiceInput, CreateInvoiceInput, UpdateInvoiceInput, ListInvoicesQuery } from '../schemas/invoice.schema';
import { paymentTermsDays } from '../schemas/invoice.schema';

// Resolve a document-level discount to a dollar amount applied to the subtotal.
// Percentage → subtotal * value/100; fixed → value. Clamped to [0, subtotal] and
// rounded to cents. EXPORTED + the frontend's lib/utils.computeDiscount MUST stay
// byte-identical (same formula, rounding, clamping) so the on-screen preview and
// the persisted totals match to the cent.
export function computeDiscountAmount(
  subtotal: number,
  discountType?: string | null,
  discountValue?: number | null,
): number {
  if (!discountType || !discountValue || discountValue <= 0 || subtotal <= 0) return 0;
  const raw = discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue;
  return Math.round(Math.min(Math.max(raw, 0), subtotal) * 100) / 100;
}

// Allocate an invoice/estimate number and insert `payload`. When `explicitNumber`
// is given (the user typed a custom number), do a single insert and surface a
// duplicate as a friendly 409. Otherwise auto-allocate `${prefix}-${year}-####`;
// the count+1 approach races under concurrency, so retry on the 23505
// unique-violation with a fresh count. `prefix` is INV or EST.
async function insertInvoiceWithNumber(
  prefix: 'INV' | 'EST',
  payload: Record<string, unknown>,
  explicitNumber?: string,
) {
  if (explicitNumber) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({ ...payload, invoice_number: explicitNumber })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ConflictError(`Invoice number "${explicitNumber}" is already in use. Choose a different number.`);
      }
      throw error;
    }
    return data;
  }

  const year = new Date().getUTCFullYear();
  let invoice: any = null;
  let invError: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { count } = await supabaseAdmin
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('doc_type', prefix === 'EST' ? 'estimate' : 'invoice');
    const number = `${prefix}-${year}-${String((count ?? 0) + 1 + attempt).padStart(4, '0')}`;
    const result = await supabaseAdmin
      .from('invoices')
      .insert({ ...payload, invoice_number: number })
      .select()
      .single();
    if (!result.error) { invoice = result.data; invError = null; break; }
    invError = result.error;
    if (result.error.code !== '23505') break;
  }
  if (invError || !invoice) throw invError ?? new Error('Failed to allocate an invoice number after retries');
  return invoice;
}

export async function listInvoices(query: ListInvoicesQuery) {
  let q = supabaseAdmin
    .from('invoices')
    .select('*, invoice_line_items(*), invoice_timesheets(*)', { count: 'exact' });

  if (query.status) q = q.eq('status', query.status);
  if (query.clientId) q = q.eq('client_id', query.clientId);
  // Default the list to real invoices; estimates have their own screen.
  q = q.eq('doc_type', query.docType ?? 'invoice');

  const offset = (query.page - 1) * query.limit;
  q = q.order('created_at', { ascending: false }).range(offset, offset + query.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function getInvoice(id: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, invoice_line_items(*), invoice_timesheets(*)')
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Invoice not found');

  // Attachments are polymorphic (documents.entity_type='invoice'), not a FK child
  // of invoices, so they need a second query. Detail + editor + getPDF all read
  // through getInvoice, so they all see attachments. (listInvoices stays lean.)
  const { data: attachments } = await supabaseAdmin
    .from('documents')
    .select('id, name, type, uploaded_at')
    .eq('entity_type', 'invoice')
    .eq('entity_id', id)
    .order('uploaded_at', { ascending: false });

  return { ...data, attachments: attachments ?? [] };
}

export async function generateInvoice(input: GenerateInvoiceInput, actorId?: string) {
  // Reject re-invoicing timesheets that are already on another invoice. The
  // invoice_timesheets junction has PK (invoice_id, timesheet_id) so duplicates
  // within ONE invoice are blocked, but nothing prevents the same TS from
  // appearing on TWO invoices → double-billing. Catch it here.
  const { data: alreadyInvoiced } = await supabaseAdmin
    .from('invoice_timesheets')
    .select('timesheet_id, invoice_id')
    .in('timesheet_id', input.timesheetIds);
  if (alreadyInvoiced && alreadyInvoiced.length > 0) {
    const tsIds = [...new Set(alreadyInvoiced.map(r => r.timesheet_id))];
    // Look up human-readable display IDs so the error names timesheets a
    // user can recognize, not opaque UUIDs.
    const { data: tsRows } = await supabaseAdmin
      .from('timesheets')
      .select('id, display_id')
      .in('id', tsIds);
    const labels = tsIds.map(id => {
      const row = (tsRows ?? []).find(r => r.id === id);
      return row?.display_id ?? id.slice(0, 8);
    });
    throw new ConflictError(
      `Some of the selected timesheets are already on an existing invoice: ${labels.join(', ')}. Reload the page and try again.`,
    );
  }

  // Fetch timesheets
  const { data: timesheets, error: tsError } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .in('id', input.timesheetIds)
    .eq('status', 'client_approved');

  if (tsError) throw tsError;

  // All requested timesheets must exist and be client_approved.
  if (!timesheets || timesheets.length !== input.timesheetIds.length) {
    throw new ValidationError('One or more timesheets are missing or not client-approved');
  }

  // Every timesheet must belong to the supplied client — guards against the
  // frontend (or a malicious caller) submitting timesheets that belong to a
  // different client.
  const mismatched = timesheets.filter(t => t.client_id !== input.clientId);
  if (mismatched.length > 0) {
    throw new ValidationError(
      `Some timesheets do not belong to the selected client: ${mismatched.map(t => t.id).join(', ')}`,
    );
  }

  // Fetch assignments for bill rates
  const assignmentIds = [...new Set((timesheets ?? []).map(t => t.assignment_id))];
  const { data: assignments } = await supabaseAdmin
    .from('assignments')
    .select('id, bill_rate, employee_id')
    .in('id', assignmentIds);

  const assignmentMap = new Map((assignments ?? []).map(a => [a.id, a]));

  // Fetch client (must exist)
  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', input.clientId)
    .single();
  if (clientErr || !client) throw new NotFoundError('Client not found');

  // Fetch employees
  const employeeIds = [...new Set((timesheets ?? []).map(t => t.employee_id))];
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, first_name, last_name')
    .in('id', employeeIds);

  const employeeMap = new Map((employees ?? []).map(e => [e.id, e]));

  // Build line items
  const lineItems = (timesheets ?? []).map(ts => {
    const asgn = assignmentMap.get(ts.assignment_id);
    const emp = employeeMap.get(ts.employee_id);
    const billRate = asgn?.bill_rate ?? 0;
    const amount = ts.total_hours * billRate;
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : ts.employee_id;
    return {
      timesheet_id: ts.id,
      employee_id: ts.employee_id,
      description: `${empName} — Week of ${ts.week_start_date} (${ts.total_hours} hrs)`,
      hours: ts.total_hours,
      bill_rate: billRate,
      amount,
    };
  });

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const taxAmount = subtotal * (input.taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  // Derive billing period from selected timesheets
  const weekStarts = (timesheets ?? []).map(t => t.week_start_date).sort();
  const weekEnds   = (timesheets ?? []).map(t => t.week_end_date).sort();
  const billingPeriodStart = weekStarts[0] ?? input.issueDate;
  const billingPeriodEnd   = weekEnds[weekEnds.length - 1] ?? input.issueDate;

  // Calculate due date from client net payment days (UTC-safe)
  const dueDate = addDaysToDate(input.issueDate, client?.net_payment_days ?? 30);

  // Generate invoice number — count+1 has a race when two requests run
  // simultaneously (both see count=N and both compute the same number). Retry
  // a few times on unique-violation with a freshly refetched count each loop.
  const year = new Date().getUTCFullYear();
  let invoice: any = null;
  let invError: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = await supabaseAdmin
      .from('invoices')
      .select('*', { count: 'exact', head: true });
    const invoiceNumber = `INV-${year}-${String((count ?? 0) + 1 + attempt).padStart(4, '0')}`;

    const result = await supabaseAdmin
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        client_id: input.clientId,
        issue_date: input.issueDate,
        due_date: dueDate,
        subtotal,
        tax_rate: input.taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        status: 'draft',
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (!result.error) {
      invoice = result.data;
      invError = null;
      break;
    }
    invError = result.error;
    // Postgres unique-violation code is 23505. Retry; any other error → bail.
    if (result.error.code !== '23505') break;
  }

  if (invError || !invoice) throw invError ?? new Error('Failed to generate invoice number after retries');

  // Insert line items
  const itemsWithInvoiceId = lineItems.map(li => ({ ...li, invoice_id: invoice.id }));
  await supabaseAdmin.from('invoice_line_items').insert(itemsWithInvoiceId);

  // Link timesheets
  const junctionRows = input.timesheetIds.map(tsId => ({
    invoice_id: invoice.id,
    timesheet_id: tsId,
  }));
  await supabaseAdmin.from('invoice_timesheets').insert(junctionRows);

  logActivity(actorId ?? null, 'created', 'invoice', invoice.id, invoice.invoice_number ?? invoice.id.slice(0, 8));

  // Notify finance + admin — fire-and-forget so notification latency never
  // delays the create response (the invoice + line items + junction are already
  // persisted above). Mirrors employees.service notifyOnboardingCompleted.
  void (async () => {
    try {
      const finIds = await getUserIdsByRole('finance');
      const admIds = await getUserIdsByRole('admin');
      const clientName = client?.company_name ?? 'a client';
      for (const uid of [...new Set([...finIds, ...admIds])]) {
        await createNotification(
          uid,
          'Invoice Generated',
          `Invoice ${invoice.invoice_number} for ${clientName} — $${totalAmount.toFixed(2)} — is ready. Review and send to client.`,
          'success', 'invoice', invoice.id,
        );
      }
    } catch (err) {
      console.error('[invoices.service] generate notification failed for invoice', invoice.id, err);
    }
  })();

  return getInvoice(invoice.id);
}

// Wave-style manual create: free-form line items (+ optional catalog products),
// P.O. number, payment terms → due date, currency. Used for both invoices and
// estimates (docType). No timesheet linkage.
export async function createInvoice(input: CreateInvoiceInput, actorId?: string) {
  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients').select('*').eq('id', input.clientId).single();
  if (clientErr || !client) throw new NotFoundError('Client not found');

  const lineItems = input.lineItems.map(li => {
    const qty = Number(li.quantity) || 0;
    const price = Number(li.unitPrice) || 0;
    const amount = Math.round(qty * price * 100) / 100;
    return {
      item_name: li.itemName ?? null,
      description: li.description ?? li.itemName ?? '',
      product_id: li.productId ?? null,
      quantity: qty,
      hours: qty,           // kept for PDF/legacy columns (qty shown in the hours column)
      bill_rate: price,     // unit price shown in the rate column
      amount,
    };
  });

  // subtotal is the raw line-item sum; the discount applies BEFORE tax, so tax +
  // total are computed on the discounted subtotal (Wave behavior).
  const subtotal = Math.round(lineItems.reduce((s, li) => s + li.amount, 0) * 100) / 100;
  const discountAmount = computeDiscountAmount(subtotal, input.discountType, input.discountValue);
  const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
  const taxAmount = Math.round(discountedSubtotal * (input.taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((discountedSubtotal + taxAmount) * 100) / 100;

  const dueDate = input.paymentTerms === 'custom' && input.dueDate
    ? input.dueDate
    : addDaysToDate(input.issueDate, paymentTermsDays(input.paymentTerms));

  const isEstimate = input.docType === 'estimate';
  const invoice = await insertInvoiceWithNumber(isEstimate ? 'EST' : 'INV', {
    client_id: input.clientId,
    issue_date: input.issueDate,
    due_date: dueDate,
    subtotal,
    discount_type: input.discountType ?? null,
    discount_value: input.discountValue ?? 0,
    discount_amount: discountAmount,
    tax_rate: input.taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: 'draft',
    doc_type: input.docType,
    estimate_status: isEstimate ? 'draft' : null,
    po_number: input.poNumber ?? null,
    payment_terms: input.paymentTerms,
    currency: input.currency,
    invoice_template_id: input.invoiceTemplateId ?? null,
    notes: input.notes ?? null,
    terms: input.terms ?? null,
  }, input.invoiceNumber || undefined);

  const itemsWithInvoiceId = lineItems.map(li => ({ ...li, invoice_id: invoice.id }));
  await supabaseAdmin.from('invoice_line_items').insert(itemsWithInvoiceId);

  logActivity(actorId ?? null, 'created', 'invoice', invoice.id, invoice.invoice_number ?? invoice.id.slice(0, 8),
    { doc_type: input.docType });

  return getInvoice(invoice.id);
}

// Convert an accepted estimate into a real invoice: clone its line items into a
// fresh INV-numbered invoice (status draft), recompute the due date from today
// + the estimate's payment terms, and mark the estimate converted + linked.
export async function convertEstimate(estimateId: string, actorId?: string) {
  const est = await getInvoice(estimateId);
  if (est.doc_type !== 'estimate') throw new ValidationError('Only estimates can be converted.');
  if (est.converted_invoice_id) throw new ConflictError('This estimate has already been converted to an invoice.');

  const issueDate = todayUTC();
  const dueDate = est.payment_terms === 'custom'
    ? est.due_date
    : addDaysToDate(issueDate, paymentTermsDays(est.payment_terms ?? 'net_30'));

  const invoice = await insertInvoiceWithNumber('INV', {
    client_id: est.client_id,
    issue_date: issueDate,
    due_date: dueDate,
    subtotal: est.subtotal,
    discount_type: est.discount_type ?? null,
    discount_value: est.discount_value ?? 0,
    discount_amount: est.discount_amount ?? 0,
    tax_rate: est.tax_rate,
    tax_amount: est.tax_amount,
    total_amount: est.total_amount,
    status: 'draft',
    doc_type: 'invoice',
    po_number: est.po_number ?? null,
    payment_terms: est.payment_terms ?? 'net_30',
    currency: est.currency ?? 'USD',
    notes: est.notes ?? null,
    terms: est.terms ?? null,
  });

  const items = (est.invoice_line_items ?? []).map((li: any) => ({
    invoice_id: invoice.id,
    item_name: li.item_name ?? null,
    description: li.description,
    product_id: li.product_id ?? null,
    quantity: li.quantity ?? li.hours,
    hours: li.hours,
    bill_rate: li.bill_rate,
    amount: li.amount,
  }));
  if (items.length > 0) await supabaseAdmin.from('invoice_line_items').insert(items);

  await supabaseAdmin.from('invoices')
    .update({ estimate_status: 'converted', converted_invoice_id: invoice.id })
    .eq('id', estimateId);

  logActivity(actorId ?? null, 'updated', 'invoice', estimateId, est.invoice_number ?? estimateId.slice(0, 8),
    { event: 'estimate_converted', invoice_id: invoice.id });

  return getInvoice(invoice.id);
}

// Public (no-auth) invoice fetch by shareable token. Stamps viewed_at + flips
// a 'sent' invoice → 'viewed' (or an estimate's status) on first open. Returns
// only client-safe fields.
export async function getPublicInvoice(token: string) {
  const { data: inv, error } = await supabaseAdmin
    .from('invoices')
    .select('*, invoice_line_items(*), clients(company_name, billing_street, billing_city, billing_state, billing_zip, billing_country, contact_name)')
    .eq('public_token', token)
    .single();
  if (error || !inv) throw new NotFoundError('Invoice not found');

  // First-open tracking (best-effort, never blocks the response).
  try {
    const patch: Record<string, unknown> = {};
    if (!inv.viewed_at) patch.viewed_at = new Date().toISOString();
    if (inv.doc_type === 'estimate') {
      if (inv.estimate_status === 'sent') patch.estimate_status = 'viewed';
    } else if (inv.status === 'sent') {
      patch.status = 'viewed';
    }
    if (Object.keys(patch).length > 0) await supabaseAdmin.from('invoices').update(patch).eq('id', inv.id);
  } catch (err) {
    console.error('[invoices] public view tracking failed for', token, err);
  }

  const amountPaid = Number(inv.amount_paid) || 0;
  return {
    ...inv,
    balance_due: Math.round(((inv.total_amount ?? 0) - amountPaid) * 100) / 100,
  };
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const inv = await getInvoice(id);
  if (!inv) throw new NotFoundError('Invoice not found');

  const updateData: Record<string, unknown> = {};
  if (input.status !== undefined) updateData.status = input.status;
  if (input.estimateStatus !== undefined) updateData.estimate_status = input.estimateStatus;
  if (input.paidAt !== undefined) updateData.paid_at = input.paidAt;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.terms !== undefined) updateData.terms = input.terms;
  if (input.poNumber !== undefined) updateData.po_number = input.poNumber;
  if (input.invoiceTemplateId !== undefined) updateData.invoice_template_id = input.invoiceTemplateId;

  // ── Editable invoice number (drafts only) ─────────────────────────────────
  if (input.invoiceNumber !== undefined && input.invoiceNumber !== inv.invoice_number) {
    if (inv.status !== 'draft') {
      throw new ValidationError("Issued invoices can't change their number.");
    }
    if (input.invoiceNumber) updateData.invoice_number = input.invoiceNumber;
  }

  // The discount type/value in effect for this update: explicit input wins,
  // else fall back to what's already stored (so a line-item-only edit keeps the
  // existing discount). Used by both recompute branches below.
  const discountType = input.discountType !== undefined ? input.discountType : inv.discount_type;
  const discountValue = input.discountValue !== undefined ? input.discountValue : inv.discount_value;

  // ── Full draft edit (Wave-style) ──────────────────────────────────────────
  // When line items are supplied, rebuild the whole document — but only while
  // it's still a draft. Issued invoices keep their line items frozen.
  if (input.lineItems !== undefined) {
    if (inv.status !== 'draft') {
      throw new ValidationError("Issued invoices can't change their line items.");
    }
    const mapped = input.lineItems.map(li => {
      const qty = Number(li.quantity) || 0;
      const price = Number(li.unitPrice) || 0;
      return {
        invoice_id: id,
        item_name: li.itemName ?? null,
        description: li.description ?? li.itemName ?? '',
        product_id: li.productId ?? null,
        quantity: qty,
        hours: qty,
        bill_rate: price,
        amount: Math.round(qty * price * 100) / 100,
      };
    });
    const subtotal = Math.round(mapped.reduce((s, li) => s + li.amount, 0) * 100) / 100;
    const discountAmount = computeDiscountAmount(subtotal, discountType, discountValue);
    const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
    const taxRate = input.taxRate ?? inv.tax_rate ?? 0;
    const taxAmount = Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;

    const issueDate = input.issueDate ?? inv.issue_date;
    const paymentTerms = input.paymentTerms ?? inv.payment_terms ?? 'net_30';
    const dueDate = paymentTerms === 'custom'
      ? (input.dueDate ?? inv.due_date)
      : addDaysToDate(issueDate, paymentTermsDays(paymentTerms));

    if (input.clientId !== undefined) updateData.client_id = input.clientId;
    updateData.issue_date = issueDate;
    updateData.payment_terms = paymentTerms;
    updateData.due_date = dueDate;
    if (input.currency !== undefined) updateData.currency = input.currency;
    updateData.subtotal = subtotal;
    updateData.discount_type = discountType ?? null;
    updateData.discount_value = discountValue ?? 0;
    updateData.discount_amount = discountAmount;
    updateData.tax_rate = taxRate;
    updateData.tax_amount = taxAmount;
    updateData.total_amount = Math.round((discountedSubtotal + taxAmount) * 100) / 100;

    await supabaseAdmin.from('invoice_line_items').delete().eq('invoice_id', id);
    await supabaseAdmin.from('invoice_line_items').insert(mapped);
  } else if (input.taxRate !== undefined || input.discountType !== undefined || input.discountValue !== undefined) {
    // Metadata-only tax/discount change: recompute from the EXISTING (raw) subtotal.
    const subtotal = Number(inv.subtotal) || 0;
    const discountAmount = computeDiscountAmount(subtotal, discountType, discountValue);
    const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
    const taxRate = input.taxRate ?? inv.tax_rate ?? 0;
    const taxAmount = Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;
    updateData.discount_type = discountType ?? null;
    updateData.discount_value = discountValue ?? 0;
    updateData.discount_amount = discountAmount;
    updateData.tax_rate = taxRate;
    updateData.tax_amount = taxAmount;
    updateData.total_amount = Math.round((discountedSubtotal + taxAmount) * 100) / 100;
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505' && updateData.invoice_number) {
      throw new ConflictError(`Invoice number "${updateData.invoice_number}" is already in use. Choose a different number.`);
    }
    throw error;
  }
  return getInvoice(id);
}

export async function deleteInvoice(id: string) {
  const inv = await getInvoice(id);
  if (inv.status !== 'draft') {
    throw new ForbiddenError('Only draft invoices can be deleted');
  }

  // Best-effort: remove the cached PDF from Supabase Storage so deleted
  // invoices don't leave orphan files growing the storage bill (and don't
  // remain accessible via a still-valid signed URL).
  if (inv.invoice_number) {
    try {
      await supabaseAdmin.storage.from('invoices').remove([`${inv.invoice_number}.pdf`]);
    } catch (err) {
      console.error('[invoices.service] failed to remove PDF from storage for', inv.invoice_number, err);
    }
  }

  // Best-effort: purge attachment files + their `documents` rows (polymorphic,
  // so no FK cascade) to avoid orphaned storage objects / rows.
  try {
    const { data: docs } = await supabaseAdmin
      .from('documents').select('id, storage_path')
      .eq('entity_type', 'invoice').eq('entity_id', id);
    if (docs && docs.length > 0) {
      await supabaseAdmin.storage.from('invoices').remove(docs.map(d => d.storage_path));
      await supabaseAdmin.from('documents').delete().eq('entity_type', 'invoice').eq('entity_id', id);
    }
  } catch (err) {
    console.error('[invoices.service] attachment cleanup failed for invoice', id, err);
  }

  const { error } = await supabaseAdmin.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

// ── Attachments ────────────────────────────────────────────────────────────────
// Upload a file attachment to an invoice (reuses the generic documents table +
// the 'invoices' storage bucket via storage.service). Verifies the invoice
// exists first so we never strand a file under a non-existent invoice id.
export async function addInvoiceAttachment(invoiceId: string, file: Express.Multer.File, uploadedBy: string) {
  await getInvoice(invoiceId); // 404s if the invoice doesn't exist
  return uploadDocument('invoice', invoiceId, file, uploadedBy);
}

// Delete an invoice attachment — but only after confirming the document really
// belongs to THIS invoice (prevents removing another entity's doc via a guessed id).
export async function removeInvoiceAttachment(invoiceId: string, docId: string) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents').select('id, entity_type, entity_id').eq('id', docId).single();
  if (error || !doc) throw new NotFoundError('Attachment not found');
  if (doc.entity_type !== 'invoice' || doc.entity_id !== invoiceId) {
    throw new ForbiddenError('That attachment does not belong to this invoice.');
  }
  await deleteDocument(docId);
}

export async function sendInvoice(id: string) {
  const inv = await getInvoice(id);

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', inv.client_id)
    .single();

  const recipientEmail = client?.billing_contact_email || client?.contact_email;
  if (!recipientEmail) {
    throw new ValidationError('Client has no billing email address on file. Add one in the client profile and try again.');
  }

  // Generate the PDF once and reuse the buffer both as the email attachment and
  // the storage signed URL (download link).
  const { buffer: pdfBuffer, signedUrl: pdfUrl } = await renderAndStoreInvoicePDF(id);
  const pdfData = buildInvoicePdfData(inv, client);

  // Attempt to send the email. Capture success/failure so the caller can
  // surface a structured warning instead of throwing a generic 500. Mirrors
  // the pattern in employees.service.ts:issueCredentials.
  let emailSent = false;
  let warning: string | undefined;
  try {
    await sendInvoiceEmail({
      to: recipientEmail,
      clientName: client?.company_name ?? 'Client',
      contactName: client?.billing_contact_name || client?.contact_name || 'Team',
      invoiceNumber: inv.invoice_number,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      currency: pdfData.currency,
      subtotal: pdfData.subtotal,
      discountType: pdfData.discountType,
      discountValue: pdfData.discountValue,
      discountAmount: pdfData.discountAmount,
      taxRate: pdfData.taxRate,
      taxAmount: pdfData.taxAmount,
      totalAmount: pdfData.totalAmount,
      amountPaid: pdfData.amountPaid,
      balanceDue: pdfData.balanceDue,
      billingPeriodStart: inv.billing_period_start ?? undefined,
      billingPeriodEnd: inv.billing_period_end ?? undefined,
      pdfUrl: pdfUrl ?? undefined,
      pdfBuffer,
      pdfFileName: `${inv.invoice_number}.pdf`,
      notes: inv.notes ?? undefined,
      terms: inv.terms ?? undefined,
      lineItems: pdfData.lineItems.map(li => ({
        itemName: li.itemName,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        isHours: li.isHours,
      })),
    });
    emailSent = true;
  } catch (err: any) {
    warning = `Invoice was prepared but the email could not be delivered (${err?.code ?? ''} ${err?.message ?? 'send failed'}).`;
    console.error('[invoices.service] sendInvoiceEmail failed for invoice', id, err);
  }

  // Re-send aware: only a DRAFT advances to 'sent' on a successful email. A
  // re-send of an already sent/viewed/overdue invoice keeps its current status
  // (never downgrade), and a failed send never changes status.
  const newStatus = emailSent && inv.status === 'draft' ? 'sent' : inv.status;
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Notify finance + admin (fire-and-forget)
  try {
    const finIds = await getUserIdsByRole('finance');
    const admIds = await getUserIdsByRole('admin');
    const clientName = client?.company_name ?? 'client';
    for (const uid of [...new Set([...finIds, ...admIds])]) {
      await createNotification(
        uid,
        'Invoice Sent',
        `Invoice ${inv.invoice_number} has been emailed to ${clientName} (${recipientEmail}). Status updated to Sent.`,
        'info', 'invoice', id,
      );
    }
  } catch (err) {
    console.error('[invoices.service] send notification failed for invoice', id, err);
  }

  return { invoice: data, emailSent, warning };
}

// Bulk-send: email several invoices at once (reuses the single send path which
// attaches the PDF + advances draft→sent). Per-invoice errors are captured so
// one bad recipient doesn't fail the whole batch.
export async function bulkSendInvoices(ids: string[]) {
  let sent = 0;
  const failed: { id: string; invoiceNumber?: string; error: string }[] = [];
  for (const id of ids.slice(0, 100)) {
    try {
      const r = await sendInvoice(id);
      if (r.emailSent) sent++;
      else failed.push({ id, invoiceNumber: r.invoice?.invoice_number, error: r.warning ?? 'Email not delivered' });
    } catch (err: any) {
      failed.push({ id, error: err?.message ?? 'Send failed' });
    }
  }
  return { sent, failed, total: ids.length };
}

// ── CSV export ────────────────────────────────────────────────────────────────

export async function exportInvoicesCSV(query: { status?: string; clientId?: string }): Promise<string> {
  let q = supabaseAdmin
    .from('invoices')
    .select(`invoice_number, issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, paid_at, clients!inner(company_name, display_id)`)
    .order('issue_date', { ascending: false });
  if (query.status) q = q.eq('status', query.status);
  if (query.clientId) q = q.eq('client_id', query.clientId);
  const { data, error } = await q;
  if (error) throw error;

  const headers = ['Invoice #','Client ID','Client','Issue Date','Due Date','Subtotal','Tax Rate','Tax Amount','Total','Status','Paid At'];
  const rows = (data ?? []).map((i: any) => [
    i.invoice_number,
    i.clients?.display_id ?? '',
    i.clients?.company_name ?? '',
    i.issue_date, i.due_date,
    i.subtotal, i.tax_rate, i.tax_amount, i.total_amount, i.status,
    i.paid_at ? new Date(i.paid_at).toISOString().split('T')[0] : '',
  ]);
  return [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ── Bulk status update ────────────────────────────────────────────────────────

export async function bulkUpdateInvoiceStatus(ids: string[], status: string) {
  const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');
  const updateData: Record<string, unknown> = { status };
  if (status === 'paid') updateData.paid_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('invoices').update(updateData).in('id', ids);
  if (error) throw error;
  return { updated: ids.length };
}

// Human label for a payment-terms code (used on the PDF/email).
const PAYMENT_TERM_LABELS: Record<string, string> = {
  on_receipt: 'Due on receipt', net_7: 'Net 7', net_14: 'Net 14',
  net_30: 'Net 30', net_45: 'Net 45', net_60: 'Net 60', custom: 'Custom',
};

// Map the invoice + client DB rows to the premium PDF data shape. Prefers the
// client's billing address, falls back to the primary address. (The old code
// read client.address — a column that doesn't exist — so the address was always
// blank; this fixes that.)
function buildInvoicePdfData(inv: any, client: any): InvoicePDFData {
  const addr = (street?: string, city?: string, state?: string, zip?: string, country?: string): string[] => {
    const lines: string[] = [];
    if (street) lines.push(street);
    const cityLine = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (cityLine) lines.push(cityLine);
    if (country && country !== 'US' && country !== 'USA') lines.push(country);
    return lines;
  };
  const clientAddressLines = (client?.billing_street || client?.billing_city)
    ? addr(client?.billing_street, client?.billing_city, client?.billing_state, client?.billing_zip, client?.billing_country)
    : addr(client?.address_street, client?.address_city, client?.address_state, client?.address_zip, client?.address_country);

  const amountPaid = Number(inv.amount_paid ?? 0);
  return {
    invoiceNumber: inv.invoice_number,
    docType: inv.doc_type === 'estimate' ? 'estimate' : 'invoice',
    status: inv.status,
    clientName: client?.company_name ?? 'Unknown Client',
    clientContactName: client?.billing_contact_name || client?.contact_name || undefined,
    clientContactEmail: client?.billing_contact_email || client?.contact_email || undefined,
    clientAddressLines,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    poNumber: inv.po_number ?? undefined,
    paymentTerms: inv.payment_terms ? (PAYMENT_TERM_LABELS[inv.payment_terms] ?? inv.payment_terms) : undefined,
    currency: inv.currency ?? 'USD',
    lineItems: (inv.invoice_line_items ?? []).map((li: Record<string, unknown>) => ({
      itemName: li.item_name ? String(li.item_name) : undefined,
      description: String(li.description ?? ''),
      quantity: Number(li.quantity ?? li.hours ?? 0),
      unitPrice: Number(li.bill_rate ?? 0),
      amount: Number(li.amount ?? 0),
      isHours: !!li.timesheet_id,
    })),
    subtotal: Number(inv.subtotal ?? 0),
    discountType: inv.discount_type ?? null,
    discountValue: inv.discount_value != null ? Number(inv.discount_value) : undefined,
    discountAmount: Number(inv.discount_amount ?? 0),
    taxRate: Number(inv.tax_rate ?? 0),
    taxAmount: Number(inv.tax_amount ?? 0),
    totalAmount: Number(inv.total_amount ?? 0),
    amountPaid,
    balanceDue: Math.round((Number(inv.total_amount ?? 0) - amountPaid) * 100) / 100,
    notes: inv.notes ?? undefined,
    terms: inv.terms ?? undefined,
  };
}

// Generate the invoice PDF, upload it to storage, cache the signed URL, and
// return BOTH the raw buffer (for emailing as an attachment) and the signed URL.
async function renderAndStoreInvoicePDF(id: string): Promise<{ buffer: Buffer; signedUrl: string | null }> {
  const inv = await getInvoice(id);
  const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', inv.client_id).single();

  const theme = await getInvoiceTheme(inv.invoice_template_id);
  const buffer = await generateInvoicePDF(buildInvoicePdfData(inv, client), theme);

  const fileName = `${inv.invoice_number}.pdf`;
  const { error: uploadError } = await supabaseAdmin
    .storage.from('invoices')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;

  // 7-day signed URL — the link is embedded in the invoice email and must
  // survive spam-folder delays.
  const { data: urlData } = await supabaseAdmin
    .storage.from('invoices')
    .createSignedUrl(fileName, 7 * 24 * 60 * 60, { download: fileName });

  await supabaseAdmin.from('invoices').update({ pdf_url: urlData?.signedUrl }).eq('id', id);
  return { buffer, signedUrl: urlData?.signedUrl ?? null };
}

export async function getInvoicePDF(id: string): Promise<string | null> {
  const { signedUrl } = await renderAndStoreInvoicePDF(id);
  return signedUrl;
}
