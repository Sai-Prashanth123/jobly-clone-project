import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { logActivity } from '../lib/activityLogger';
import { sendInvoiceEmail } from '../lib/mailer';
import { createNotification, getUserIdsByRole } from './notifications.service';
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
  // Fetch timesheets
  const { data: timesheets, error: tsError } = await supabaseAdmin
    .from('timesheets')
    .select('*, timesheet_entries(*)')
    .in('id', input.timesheetIds)
    .eq('status', 'client_approved');

  if (tsError) throw tsError;

  // Fetch assignments for bill rates
  const assignmentIds = [...new Set((timesheets ?? []).map(t => t.assignment_id))];
  const { data: assignments } = await supabaseAdmin
    .from('assignments')
    .select('id, bill_rate, employee_id')
    .in('id', assignmentIds);

  const assignmentMap = new Map((assignments ?? []).map(a => [a.id, a]));

  // Fetch client
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', input.clientId)
    .single();

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
  const { addDaysToDate, todayUTC } = await import('../lib/dateUtils');
  const dueDate = addDaysToDate(input.issueDate, client?.net_payment_days ?? 30);

  // Generate invoice number
  const year = new Date().getUTCFullYear();
  const { count } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact', head: true });
  const invoiceNumber = `INV-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  // Insert invoice
  const { data: invoice, error: invError } = await supabaseAdmin
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

  if (invError) throw invError;

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
  } catch (_) { /* non-blocking */ }

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
    throw new Error('Client has no billing email address on file');
  }

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

  // Mark invoice as sent
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({ status: 'sent' })
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
  } catch (_) { /* non-blocking */ }

  return data;
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

  // Get signed URL (1 hour)
  const { data: urlData } = await supabaseAdmin
    .storage
    .from('invoices')
    .createSignedUrl(fileName, 3600);

  // Cache pdf_url on invoice
  await supabaseAdmin
    .from('invoices')
    .update({ pdf_url: urlData?.signedUrl })
    .eq('id', id);

  return urlData?.signedUrl ?? null;
}
