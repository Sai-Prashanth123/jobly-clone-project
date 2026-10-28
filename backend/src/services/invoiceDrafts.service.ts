import { supabaseAdmin } from '../config/supabase';
import { logActivity } from '../lib/activityLogger';
import { bustNavBadgeCache } from './navBadges.service';
import { insertInvoiceWithNumber } from './invoices.service';
import { resolveTerms } from '../lib/invoiceTerms';
import { todayUTC } from '../lib/dateUtils';

/**
 * Draft invoices that assemble themselves as timesheets are approved.
 *
 * Invoicing was entirely manual: open Invoices → New, pick the client, tick
 * the approved timesheets, save, send. Every ingredient already existed —
 * generateInvoice builds line items from timesheet IDs, invoice_timesheets
 * records which sheets are on which invoice, and the readiness sweep already
 * knew how to find approved work nobody had billed. This is the wiring.
 *
 * THE MODEL: one open draft per client, recomputed from the truth.
 *
 * When a project manager approves a timesheet it joins that client's open
 * draft, and the draft is then rebuilt from the FULL set of timesheets linked
 * to it rather than patched by adding one line. Incremental arithmetic on
 * money drifts — a rate corrected after the fact, an approval reversed, a
 * sheet moved to another assignment — and a recomputed total cannot. It also
 * makes the sync idempotent: running it twice changes nothing.
 *
 * Nothing here sends anything. The draft is prepared and finance sends it,
 * because an invoice is money claimed from a customer and a wrong bill rate
 * reaching the client before it reaches us is not recoverable by an apology.
 */

export interface DraftSyncResult {
  clientId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  timesheetCount: number;
  total: number;
  blockers: string[];
  action: 'created' | 'updated' | 'removed' | 'noop';
}

interface TimesheetRow {
  id: string;
  display_id: string | null;
  employee_id: string;
  assignment_id: string;
  client_id: string;
  total_hours: number | null;
  week_start_date: string;
  week_end_date: string;
  client_signed_path: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Approved timesheets for this client that are not on any invoice yet. */
async function unbilledApproved(clientId: string): Promise<TimesheetRow[]> {
  const { data: approved, error } = await supabaseAdmin
    .from('timesheets')
    .select('id, display_id, employee_id, assignment_id, client_id, total_hours, week_start_date, week_end_date, client_signed_path')
    .eq('client_id', clientId)
    .eq('status', 'manager_approved');
  if (error) {
    console.error('[invoiceDrafts] could not read approved timesheets', clientId, error);
    throw error;
  }
  const rows = (approved ?? []) as TimesheetRow[];
  if (rows.length === 0) return [];

  // Exclude anything already on an invoice — including this client's own open
  // draft, which is re-linked from scratch below.
  const { data: linked, error: linkErr } = await supabaseAdmin
    .from('invoice_timesheets')
    .select('timesheet_id, invoice_id')
    .in('timesheet_id', rows.map(r => r.id));
  if (linkErr) {
    console.error('[invoiceDrafts] could not read invoice links', clientId, linkErr);
    throw linkErr;
  }

  const draft = await openDraftFor(clientId);
  const onAnotherInvoice = new Set(
    (linked ?? []).filter(l => l.invoice_id !== draft?.id).map(l => l.timesheet_id),
  );
  return rows.filter(r => !onAnotherInvoice.has(r.id));
}

/** This client's open, self-assembled draft, if there is one. */
async function openDraftFor(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, issue_date, payment_terms, tax_rate, blockers_ack_at')
    .eq('client_id', clientId)
    .eq('doc_type', 'invoice')
    .eq('status', 'draft')
    .eq('auto_generated', true)
    .maybeSingle();
  if (error) {
    console.error('[invoiceDrafts] could not read the open draft', clientId, error);
    throw error;
  }
  return data;
}

/**
 * What is wrong with this draft, in words finance can act on.
 *
 * The decision was to build the invoice anyway and flag the problem: a client
 * skipped because one assignment is missing a rate goes unbilled for weeks,
 * and nobody notices until the money is missed.
 */
export function collectBlockers(opts: {
  timesheets: TimesheetRow[];
  rateByAssignment: Map<string, number>;
  nameByEmployee: Map<string, string>;
  billingEmail?: string | null;
}): string[] {
  const { timesheets, rateByAssignment, nameByEmployee, billingEmail } = opts;
  const out: string[] = [];

  const noRate = new Set<string>();
  for (const ts of timesheets) {
    if (!(rateByAssignment.get(ts.assignment_id) ?? 0)) {
      noRate.add(nameByEmployee.get(ts.employee_id) ?? ts.employee_id.slice(0, 8));
    }
  }
  for (const who of noRate) {
    out.push(`${who} has no bill rate on their assignment — their hours bill at zero.`);
  }

  const unsigned = timesheets.filter(t => !t.client_signed_path).length;
  if (unsigned > 0) {
    out.push(
      `${unsigned} of ${timesheets.length} timesheet${timesheets.length === 1 ? '' : 's'} has no client-signed proof attached.`,
    );
  }

  if (!billingEmail) {
    out.push('This client has no billing contact email, so the invoice cannot be sent.');
  }

  return out;
}

/**
 * Bring this client's open draft in line with their approved, unbilled work.
 *
 * Safe to call as often as you like: it recomputes from the linked timesheets
 * every time, so a second run is a no-op and a reversed approval drops the
 * line back out.
 */
export async function syncClientDraft(clientId: string, actorId?: string): Promise<DraftSyncResult> {
  const timesheets = await unbilledApproved(clientId);
  const existing = await openDraftFor(clientId);

  // Nothing approved and waiting: an empty draft is noise on the invoice list.
  if (timesheets.length === 0) {
    if (existing) {
      await supabaseAdmin.from('invoice_timesheets').delete().eq('invoice_id', existing.id);
      await supabaseAdmin.from('invoice_line_items').delete().eq('invoice_id', existing.id);
      await supabaseAdmin.from('invoices').delete().eq('id', existing.id);
      bustNavBadgeCache();
      return { clientId, timesheetCount: 0, total: 0, blockers: [], action: 'removed' };
    }
    return { clientId, timesheetCount: 0, total: 0, blockers: [], action: 'noop' };
  }

  const [{ data: client }, { data: assignments }, { data: employees }] = await Promise.all([
    supabaseAdmin.from('clients')
      .select('id, company_name, billing_contact_email, contact_email, net_payment_days, currency')
      .eq('id', clientId).single(),
    supabaseAdmin.from('assignments')
      .select('id, bill_rate').in('id', [...new Set(timesheets.map(t => t.assignment_id))]),
    supabaseAdmin.from('employees')
      .select('id, first_name, last_name').in('id', [...new Set(timesheets.map(t => t.employee_id))]),
  ]);

  const rateByAssignment = new Map<string, number>(
    (assignments ?? []).map(a => [a.id as string, Number(a.bill_rate) || 0]),
  );
  const nameByEmployee = new Map<string, string>(
    (employees ?? []).map(e => [e.id as string, `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()]),
  );

  // Rebuilt from the full linked set every run — see the note at the top.
  const lineItems = timesheets
    .slice()
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
    .map(ts => {
      const rate = rateByAssignment.get(ts.assignment_id) ?? 0;
      const hours = Number(ts.total_hours) || 0;
      const who = nameByEmployee.get(ts.employee_id) || ts.employee_id.slice(0, 8);
      return {
        timesheet_id: ts.id,
        employee_id: ts.employee_id,
        item_name: who,
        description: `${who} — week of ${ts.week_start_date} (${hours} hrs)`,
        quantity: hours,
        hours,
        bill_rate: rate,
        amount: round2(hours * rate),
      };
    });

  const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
  const taxRate = Number(existing?.tax_rate) || 0;
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const billingEmail = client?.billing_contact_email || client?.contact_email || null;
  const blockers = collectBlockers({ timesheets, rateByAssignment, nameByEmployee, billingEmail });

  const weeks = timesheets.map(t => t.week_start_date).sort();
  const ends = timesheets.map(t => t.week_end_date).sort();
  const common = {
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: total,
    billing_period_start: weeks[0],
    billing_period_end: ends[ends.length - 1],
    blockers,
    updated_at: new Date().toISOString(),
  };

  let invoiceId = existing?.id as string | undefined;
  let invoiceNumber = existing?.invoice_number as string | undefined;
  let action: DraftSyncResult['action'] = 'updated';

  if (!invoiceId) {
    // Same allocator the manual paths use, so the numbering sequence and its
    // race retry are not reimplemented here. Terms come from the client's own
    // net_payment_days through the shared resolver, which is what stopped a
    // Net 45 client being stamped Net 30.
    const issueDate = todayUTC();
    const { paymentTerms, dueDate } = resolveTerms({
      issueDate, clientNetDays: client?.net_payment_days ?? 30,
    });

    const created = await insertInvoiceWithNumber('INV', {
      client_id: clientId,
      issue_date: issueDate,
      due_date: dueDate,
      payment_terms: paymentTerms,
      currency: client?.currency ?? 'USD',
      status: 'draft',
      doc_type: 'invoice',
      auto_generated: true,
      ...common,
    });
    invoiceId = created.id as string;
    invoiceNumber = created.invoice_number as string;
    action = 'created';
  } else {
    const { error } = await supabaseAdmin.from('invoices').update(common).eq('id', invoiceId);
    if (error) {
      console.error('[invoiceDrafts] could not update the draft', invoiceId, error);
      throw error;
    }
  }

  // Replace the lines and the links rather than diffing them: the set is small
  // and a replace cannot leave a stale row behind.
  await supabaseAdmin.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
  await supabaseAdmin.from('invoice_timesheets').delete().eq('invoice_id', invoiceId);

  const { error: liErr } = await supabaseAdmin.from('invoice_line_items').insert(
    lineItems.map(li => ({ invoice_id: invoiceId, ...li, timesheet_id: li.timesheet_id })),
  );
  if (liErr) {
    console.error('[invoiceDrafts] could not write line items', invoiceId, liErr);
    throw liErr;
  }
  const { error: tsErr } = await supabaseAdmin.from('invoice_timesheets').insert(
    timesheets.map(t => ({ invoice_id: invoiceId, timesheet_id: t.id })),
  );
  if (tsErr) {
    console.error('[invoiceDrafts] could not link timesheets', invoiceId, tsErr);
    throw tsErr;
  }

  bustNavBadgeCache();

  if (action === 'created') {
    await logActivity(actorId ?? null, 'created', 'invoice', invoiceId!, invoiceNumber ?? invoiceId!, {
      event: 'auto_draft_created', client: client?.company_name, timesheets: timesheets.length, total,
    });
  }

  return {
    clientId, invoiceId, invoiceNumber,
    timesheetCount: timesheets.length, total, blockers, action,
  };
}

/**
 * Called when a timesheet reaches manager_approved (or leaves it).
 *
 * Deliberately swallows its own failure: approving a timesheet must not fail
 * because the draft could not be assembled. The approval is the user's action
 * and is already committed; the draft is a convenience that the next approval,
 * or the nightly sweep, will produce.
 */
export async function onTimesheetApprovalChanged(clientId: string, actorId?: string): Promise<void> {
  try {
    const result = await syncClientDraft(clientId, actorId);
    if (result.action !== 'noop') {
      console.log(
        `[invoiceDrafts] ${result.action} ${result.invoiceNumber ?? ''} for client ${clientId}: ` +
        `${result.timesheetCount} timesheet(s), ${result.total}, ${result.blockers.length} blocker(s)`,
      );
    }
  } catch (err) {
    console.error('[invoiceDrafts] draft sync failed after an approval change', clientId, err);
  }
}
