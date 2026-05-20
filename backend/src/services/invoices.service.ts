import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../lib/errors';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { logActivity } from '../lib/activityLogger';
import { sendInvoiceEmail, mailerConfigured } from '../lib/mailer';
import { createNotification, getUserIdsByRole } from './notifications.service';
import { addDaysToDate } from '../lib/dateUtils';
import type { GenerateInvoiceInput, UpdateInvoiceInput, ListInvoicesQuery } from '../schemas/invoice.schema';

export async function listInvoices(query: ListInvoicesQuery) {
  let q = supabaseAdmin
    .from('invoices')
    .select('*, invoice_line_items(*), invoice_timesheets(*)', { count: 'exact' });

  if (query.status) q = q.eq('status', query.status);
  if (query.clientId) q = q.eq('client_id', query.clientId);

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
  return data;
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

  // Notify finance + admin (fire-and-forget)
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

  return getInvoice(invoice.id);
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const inv = await getInvoice(id);
  if (!inv) throw new NotFoundError('Invoice not found');

  const updateData: Record<string, unknown> = {};
  if (input.status !== undefined) updateData.status = input.status;
  if (input.paidAt !== undefined) updateData.paid_at = input.paidAt;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.taxRate !== undefined) {
    updateData.tax_rate = input.taxRate;
    updateData.tax_amount = inv.subtotal * (input.taxRate / 100);
    updateData.total_amount = inv.subtotal + (inv.subtotal * (input.taxRate / 100));
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
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

  const { error } = await supabaseAdmin.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

export async function sendInvoice(id: string) {
  const inv = await getInvoice(id);

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', inv.client_id)
    .single();

  // Generate PDF and get signed URL
  const pdfUrl = await getInvoicePDF(id);

  const recipientEmail = client?.billing_contact_email || client?.contact_email;
  if (!recipientEmail) {
    throw new ValidationError('Client has no billing email address on file. Add one in the client profile and try again.');
  }

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
      subtotal: inv.subtotal,
      taxRate: inv.tax_rate ?? 0,
      taxAmount: inv.tax_amount ?? 0,
      totalAmount: inv.total_amount,
      billingPeriodStart: inv.billing_period_start ?? undefined,
      billingPeriodEnd: inv.billing_period_end ?? undefined,
      pdfUrl: pdfUrl ?? undefined,
      notes: inv.notes ?? undefined,
      lineItems: (inv.invoice_line_items ?? []).map((li: Record<string, unknown>) => ({
        description: String(li.description ?? ''),
        hours: Number(li.hours ?? 0),
        billRate: Number(li.bill_rate ?? 0),
        amount: Number(li.amount ?? 0),
      })),
    });
    emailSent = true;
  } catch (err: any) {
    warning = `Invoice was prepared but the email could not be delivered (${err?.code ?? ''} ${err?.message ?? 'send failed'}).`;
    console.error('[invoices.service] sendInvoiceEmail failed for invoice', id, err);
  }

  // Mark invoice as 'sent' only when the email actually went out. Otherwise
  // leave it as draft so the user can retry without confusion.
  const newStatus = emailSent ? 'sent' : inv.status;
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

export async function getInvoicePDF(id: string) {
  const inv = await getInvoice(id);

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', inv.client_id)
    .single();

  const pdfBuffer = await generateInvoicePDF({
    invoiceNumber: inv.invoice_number,
    clientName: client?.company_name ?? 'Unknown Client',
    clientAddress: client?.address ? `${client.address}` : undefined,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    lineItems: (inv.invoice_line_items ?? []).map((li: Record<string, unknown>) => ({
      description: String(li.description ?? ''),
      hours: Number(li.hours ?? 0),
      billRate: Number(li.bill_rate ?? 0),
      amount: Number(li.amount ?? 0),
    })),
    subtotal: inv.subtotal,
    taxRate: inv.tax_rate ?? 0,
    taxAmount: inv.tax_amount ?? 0,
    totalAmount: inv.total_amount,
  });

  // Upload to Supabase Storage
  const fileName = `${inv.invoice_number}.pdf`;
  const { error: uploadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Get signed URL (7 days — the link is embedded in the invoice email and
  // must survive spam-folder delays. 1 hour was too short.)
  const { data: urlData } = await supabaseAdmin
    .storage
    .from('invoices')
    .createSignedUrl(fileName, 7 * 24 * 60 * 60);

  // Cache pdf_url on invoice
  await supabaseAdmin
    .from('invoices')
    .update({ pdf_url: urlData?.signedUrl })
    .eq('id', id);

  return urlData?.signedUrl ?? null;
}
