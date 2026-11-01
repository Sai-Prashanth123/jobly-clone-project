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
 * THE MODEL: one open draft per client PER BILLING MONTH, recomputed from the
 * truth.
 *
 * When a project manager approves a timesheet it joins that client's draft for
 * the month the work was done in, and that draft is then rebuilt from the FULL
 * set of timesheets linked to it rather than patched by adding one line.
 * Incremental arithmetic on money drifts — a rate corrected after the fact, an
 * approval reversed, a sheet moved to another assignment — and a recomputed
 * total cannot. It also makes the sync idempotent: running it twice changes
 * nothing.
 *
 * The month matters. A single draft per client accumulated every approved,
 * unbilled sheet no matter how old, so one client with a backlog assembled 51
 * timesheets spanning 14 months into a single $85,920 invoice. That is not a
 * bill anybody sends. Months are the unit customers reconcile against, so they
 * are the unit the drafts are cut on.
 *
 * Nothing here sends anything. The draft is prepared and finance sends it,
 * because an invoice is money claimed from a customer and a wrong bill rate
 * reaching the client before it reaches us is not recoverable by an apology.
 */

export interface DraftSyncResult {
  clientId: string;
  /** The billing month this result is about, as YYYY-MM. */
  period: string;
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

export interface BillingMonth {
  /** YYYY-MM. The key a draft is matched to its month on. */
  key: string;
  /** First day of the month — stored as billing_period_start. */
  start: string;
  /** Last day of the month — stored as billing_period_end. */
  end: string;
}

/**
 * The billing month a timesheet belongs to.
 *
 * Decided by week_start_date alone, so a week straddling month end (Mon 28 Oct
 * → Sun 3 Nov) bills wholly in October. Splitting it would split one signed
 * sheet's hours across two invoices, and the sheet is the thing the client put
 * their name to.
 *
 * Parsed as text rather than through Date: `new Date('2026-10-01')` is UTC
 * midnight, which is the 30th of September anywhere west of UTC, and the month
 * would silently be wrong for a third of the world.
 */
export function billingMonthOf(weekStartDate: string): BillingMonth {
  const [y, m] = weekStartDate.split('-');
  const key = `${y}-${m}`;
  // Day 0 of the following month is the last day of this one. Date.UTC takes a
  // zero-based month, so passing the 1-based number already means "next".
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return { key, start: `${key}-01`, end: `${key}-${String(lastDay).padStart(2, '0')}` };
}

/** Approved work split into the months it will be billed in. */
export function groupByBillingMonth<T extends { week_start_date: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const { key } = billingMonthOf(row.week_start_date);
    const bucket = out.get(key);
    if (bucket) bucket.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/**
 * Which month an existing draft covers.
 *
 * Taken from the stored period rather than from its lines, so a draft written
 * before this was month-scoped — its period_start is the first week worked,
 * not the 1st — still lands in the right bucket and gets rewritten in place.
 */
function monthKeyOfDraft(draft: { billing_period_start?: string | null }): string {
  return String(draft.billing_period_start ?? '').slice(0, 7);
}

/**
 * Approved timesheets for this client that are not on any invoice yet.
 *
 * `ownDraftIds` are the client's open auto-drafts: sheets linked to those are
 * still unbilled, because those drafts are about to be rebuilt from scratch.
 */
async function unbilledApproved(clientId: string, ownDraftIds: Set<string>): Promise<TimesheetRow[]> {
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

  const onAnotherInvoice = new Set(
    (linked ?? []).filter(l => !ownDraftIds.has(l.invoice_id as string)).map(l => l.timesheet_id),
  );
  return rows.filter(r => !onAnotherInvoice.has(r.id));
}

/** Every open, self-assembled draft this client has — at most one per month. */
async function openAutoDrafts(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    // `blockers` as well as the acknowledgement: a confirmation is only valid
    // for the blocker set it was given, so the sync has to compare the two.
    .select('id, invoice_number, issue_date, payment_terms, tax_rate, blockers, blockers_ack_at, billing_period_start')
    .eq('client_id', clientId)
    .eq('doc_type', 'invoice')
    .eq('status', 'draft')
    .eq('auto_generated', true);
  if (error) {
    console.error('[invoiceDrafts] could not read the open drafts', clientId, error);
    throw error;
  }
  return data ?? [];
}

/**
 * This client's open auto-draft for one billing month, if there is one.
 *
 * Used after a failed insert to find the draft a concurrent sync created
 * first — see the catch in syncMonthDraft.
 */
async function openAutoDraftForMonth(clientId: string, monthStart: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, issue_date, payment_terms, tax_rate, blockers, blockers_ack_at, billing_period_start')
    .eq('client_id', clientId)
    .eq('doc_type', 'invoice')
    .eq('status', 'draft')
    .eq('auto_generated', true)
    .eq('billing_period_start', monthStart)
    .maybeSingle();
  if (error) {
    console.error('[invoiceDrafts] could not re-read the draft for', clientId, monthStart, error);
    return null;
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
export async function syncClientDraft(clientId: string, actorId?: string): Promise<DraftSyncResult[]> {
  const drafts = await openAutoDrafts(clientId);
  const timesheets = await unbilledApproved(clientId, new Set(drafts.map(d => d.id as string)));
  const byMonth = groupByBillingMonth(timesheets);

  const results: DraftSyncResult[] = [];
  const draftForMonth = new Map(drafts.map(d => [monthKeyOfDraft(d), d]));

  // A month whose work has gone — the approval was reversed, or the sheets
  // were moved onto a manual invoice. An empty draft is noise on the list.
  for (const draft of drafts) {
    const key = monthKeyOfDraft(draft);
    if (byMonth.has(key)) continue;
    await supabaseAdmin.from('invoice_timesheets').delete().eq('invoice_id', draft.id);
    await supabaseAdmin.from('invoice_line_items').delete().eq('invoice_id', draft.id);
    await supabaseAdmin.from('invoices').delete().eq('id', draft.id);
    results.push({ clientId, period: key, timesheetCount: 0, total: 0, blockers: [], action: 'removed' });
  }

  if (byMonth.size === 0) {
    if (results.length > 0) bustNavBadgeCache();
    return results;
  }

  // Looked up once for every month rather than once per month: the client and
  // the rates are the same whichever period the hours fall in.
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

  // Oldest month first, so the invoice numbers run in the order the work was
  // done rather than in whatever order the map happened to be built.
  for (const key of [...byMonth.keys()].sort()) {
    results.push(await syncMonthDraft({
      clientId, actorId, client,
      month: billingMonthOf(byMonth.get(key)![0].week_start_date),
      timesheets: byMonth.get(key)!,
      existing: draftForMonth.get(key),
      rateByAssignment, nameByEmployee,
    }));
  }

  bustNavBadgeCache();
  return results;
}

/** The draft that holds one client's work for one billing month. */
async function syncMonthDraft(a: {
  clientId: string;
  actorId?: string;
  client: { company_name?: string; billing_contact_email?: string | null; contact_email?: string | null; net_payment_days?: number | null; currency?: string | null } | null;
  month: BillingMonth;
  timesheets: TimesheetRow[];
  existing?: {
    id: string; invoice_number?: string; tax_rate?: number | null;
    blockers?: string[] | null; blockers_ack_at?: string | null;
  } | undefined;
  rateByAssignment: Map<string, number>;
  nameByEmployee: Map<string, string>;
}): Promise<DraftSyncResult> {
  const { clientId, actorId, client, month, timesheets, existing, rateByAssignment, nameByEmployee } = a;

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

  const common = {
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: total,
    // The whole month, not the first and last week actually worked. It is the
    // period the invoice covers, it is stable as more weeks are approved into
    // the same draft, and it is what the uniqueness index matches on.
    billing_period_start: month.start,
    billing_period_end: month.end,
    blockers,
    updated_at: new Date().toISOString(),
  };

  let invoiceId = existing?.id as string | undefined;
  let invoiceNumber = existing?.invoice_number as string | undefined;
  let action: DraftSyncResult['action'] = 'updated';
  // The row the update applies to: the draft we already knew about, or the one
  // a racing sync created first (see the catch below).
  let target = existing;

  if (!invoiceId) {
    // Same allocator the manual paths use, so the numbering sequence and its
    // race retry are not reimplemented here. Terms come from the client's own
    // net_payment_days through the shared resolver, which is what stopped a
    // Net 45 client being stamped Net 30.
    const issueDate = todayUTC();
    const { paymentTerms, dueDate } = resolveTerms({
      issueDate, clientNetDays: client?.net_payment_days ?? 30,
    });

    try {
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
    } catch (err) {
      // Two approvals for the same client and the same billing month can race:
      // both find no draft, both insert, and migration 061's partial unique
      // index on (client_id, billing_period_start) rejects the loser.
      // insertInvoiceWithNumber answers 23505 by bumping the invoice number,
      // which cannot resolve THIS conflict — client_id and
      // billing_period_start do not change — so all six attempts fail
      // identically. onTimesheetApprovalChanged then swallows the throw, and
      // the second timesheet silently stays off the draft until something else
      // triggers a sync.
      //
      // So adopt the draft the winner created and go on to update it. A
      // genuine insert failure still surfaces, because there is no draft to
      // find.
      const adopted = await openAutoDraftForMonth(clientId, month.start);
      if (!adopted) throw err;
      console.warn('[invoiceDrafts] adopted a concurrently created draft', adopted.id, month.key);
      invoiceId = adopted.id as string;
      invoiceNumber = adopted.invoice_number as string;
      target = adopted;
    }
  }

  if (action !== 'created') {
    // A confirmation covers the blockers somebody actually read. The sync
    // rewrites `blockers` every run but used to leave `blockers_ack_at` alone,
    // so a blocker that appeared AFTER the confirmation passed sendInvoice's
    // gate unseen — finance confirms "1 timesheet has no signed proof", a
    // second employee's hours then arrive at a zero bill rate, and the invoice
    // goes to the client with nobody having looked at the new problem.
    const acknowledged = (target?.blockers ?? []) as string[];
    const key = (xs: string[]) => [...xs].sort().join('\u0000');
    const unchanged = key(acknowledged) === key(blockers);

    const { error } = await supabaseAdmin
      .from('invoices')
      .update(unchanged ? common : { ...common, blockers_ack_at: null })
      .eq('id', invoiceId);
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

  if (action === 'created') {
    await logActivity(actorId ?? null, 'created', 'invoice', invoiceId!, invoiceNumber ?? invoiceId!, {
      event: 'auto_draft_created', client: client?.company_name, period: month.key,
      timesheets: timesheets.length, total,
    });
  }

  return {
    clientId, period: month.key, invoiceId, invoiceNumber,
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
    const results = await syncClientDraft(clientId, actorId);
    for (const result of results) {
      if (result.action === 'noop') continue;
      console.log(
        `[invoiceDrafts] ${result.action} ${result.invoiceNumber ?? ''} ${result.period} ` +
        `for client ${clientId}: ${result.timesheetCount} timesheet(s), ${result.total}, ` +
        `${result.blockers.length} blocker(s)`,
      );
    }
  } catch (err) {
    console.error('[invoiceDrafts] draft sync failed after an approval change', clientId, err);
  }
}
