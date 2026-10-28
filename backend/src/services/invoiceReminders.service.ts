import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { todayUTC, daysBetween } from '../lib/dateUtils';
import { sendInvoiceReminderEmail, mailerConfigured } from '../lib/mailer';
import { logActivity } from '../lib/activityLogger';
import { ValidationError, NotFoundError } from '../lib/errors';
import { bustNavBadgeCache } from './navBadges.service';

/**
 * Chasing unpaid invoices.
 *
 * WHAT WAS WRONG, measured against production rather than guessed.
 *
 * The nightly sweep tested the day offset with `REMINDER_OFFSETS.includes(n)`
 * over a fixed list of [-3, 0, 3, 7, 14] — an exact-day equality against a
 * list that ends. Two consequences, both of them live:
 *
 *   1. THE SEQUENCE RAN OUT. Every outstanding invoice in the database had its
 *      last reminder on precisely due+14 and nothing afterwards. Five
 *      invoices, $65,155, between 59 and 111 days past due, no chase email for
 *      over six weeks. "If it passed then it should automatically trigger the
 *      mail" — it did, five times, and then stopped forever.
 *   2. A MISSED NIGHT WAS LOST. If the Lambda failed on day +7 that invoice
 *      got nothing until +14, and after +14 nothing at all.
 *
 * So the milestones are now GENERATED from the current offset rather than
 * looked up in a list, and what has already been sent is recorded per
 * milestone in `invoices.reminded_offsets` rather than as a single "something
 * went out that day" timestamp.
 *
 * The decisions are exported as pure functions; the IO is thin wrappers around
 * them. That is the only part worth testing, and it is the part that decides
 * whether a customer gets mailed.
 */

const PORTAL_URL = env.FRONTEND_URL;

/** The fixed early milestones: three days before due, on the due date, then +3, +7, +14. */
export const EARLY_OFFSETS = [-3, 0, 3, 7, 14];

/** After +14, every fortnight: +28, +42, +56 … */
export const RECURRING_EVERY_DAYS = 14;

/**
 * Stop chasing by email after this many days past due.
 *
 * Not because the debt stops mattering, but because an automated nudge has
 * stopped being the right instrument by then — at six months this belongs with
 * a person. The invoice stays overdue, stays in the sidebar count and stays in
 * the AP digest; only the automatic mail stops.
 */
export const MAX_OFFSET_DAYS = 180;

export type ReminderTone = 'upcoming' | 'due' | 'overdue';

export function toneFor(offset: number): ReminderTone {
  return offset < 0 ? 'upcoming' : offset === 0 ? 'due' : 'overdue';
}

/** Every milestone that exists up to and including `offset`. */
export function milestonesUpTo(offset: number): number[] {
  const out = EARLY_OFFSETS.filter(o => o <= offset);
  const last = EARLY_OFFSETS[EARLY_OFFSETS.length - 1];
  for (let o = last + RECURRING_EVERY_DAYS; o <= Math.min(offset, MAX_OFFSET_DAYS); o += RECURRING_EVERY_DAYS) {
    out.push(o);
  }
  return out;
}

/**
 * Which milestones this invoice is due but has not had.
 *
 * Returns ALL of them so the caller can record all of them, but the caller
 * sends ONE email — tone taken from where the invoice is today, not from the
 * oldest thing it missed. Mailing a customer four times in one night because a
 * Lambda failed for a week is how a reminder system gets switched off, and an
 * invoice entered three weeks late should get one nudge, not five.
 */
export function pickReminderOffsets(currentOffset: number, remindedOffsets: string[]): number[] {
  if (currentOffset > MAX_OFFSET_DAYS) return [];
  const already = new Set((remindedOffsets ?? []).map(String));
  return milestonesUpTo(currentOffset).filter(o => !already.has(String(o)));
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function balanceOf(inv: { total_amount?: number | null; amount_paid?: number | null }): number {
  return round2((inv.total_amount ?? 0) - (inv.amount_paid ?? 0));
}

/** Statuses that mean "issued, not settled". */
export const OUTSTANDING_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];

export interface WentOverdue {
  id: string;
  invoiceNumber: string;
  balance: number;
  dueDate: string;
}

/**
 * Flip issued, unsettled, past-due invoices to `overdue`.
 *
 * `partially_paid` is included. It was not, which is why a $21,840 invoice 59
 * days past due with a part payment against it appeared in no overdue list, no
 * dashboard tile and no report — while still being sent reminders, because the
 * reminder sweep did include it. The two disagreed about the same invoice.
 */
export async function markOverdueInvoices(): Promise<WentOverdue[]> {
  const today = todayUTC();

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, total_amount, amount_paid, due_date')
    .eq('doc_type', 'invoice')
    .in('status', ['sent', 'viewed', 'partially_paid'])
    .lt('due_date', today);

  // The error was being discarded here. A failed query then looked exactly
  // like "nothing is overdue", which is why four nights of clean logs proved
  // nothing at all about whether this worked.
  if (error) {
    console.error('[invoiceReminders] could not read invoices to mark overdue', error);
    return [];
  }

  const wentOverdue: WentOverdue[] = [];
  for (const inv of data ?? []) {
    const balance = balanceOf(inv);
    if (balance <= 0.005) continue;
    const { error: upErr } = await supabaseAdmin
      .from('invoices').update({ status: 'overdue' }).eq('id', inv.id);
    if (upErr) {
      console.error('[invoiceReminders] could not mark overdue', inv.invoice_number, upErr);
      continue;
    }
    wentOverdue.push({
      id: inv.id,
      invoiceNumber: inv.invoice_number ?? inv.id.slice(0, 8),
      balance,
      dueDate: inv.due_date,
    });
  }

  if (wentOverdue.length > 0) bustNavBadgeCache();
  return wentOverdue;
}

interface ClientContact {
  billing_contact_email?: string | null;
  billing_contact_name?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
}

export function recipientOf(client: ClientContact | null | undefined): { to?: string; name: string } {
  return {
    to: client?.billing_contact_email || client?.contact_email || undefined,
    name: client?.billing_contact_name || client?.contact_name || client?.company_name || 'there',
  };
}

interface ReminderInvoice {
  id: string;
  invoice_number?: string | null;
  due_date: string;
  currency?: string | null;
  public_token?: string | null;
  reminder_count?: number | null;
  reminded_offsets?: string[] | null;
}

/**
 * Send one reminder and record it.
 *
 * `offsetsToRecord` is what the send consumes. The nightly sweep passes the
 * milestones it is covering; a manual send passes none, deliberately — see
 * sendInvoiceReminderNow.
 */
export async function sendReminderFor(
  inv: ReminderInvoice,
  client: ClientContact | null | undefined,
  opts: {
    tone: ReminderTone;
    offsetsToRecord: number[];
    trigger: 'nightly' | 'manual';
    actorId?: string | null;
    balance: number;
  },
): Promise<{ to: string }> {
  const { to, name } = recipientOf(client);
  if (!to) throw new ValidationError('This client has no billing contact email on file, so there is nobody to remind.');

  await sendInvoiceReminderEmail({
    to,
    contactName: name,
    invoiceNumber: inv.invoice_number ?? inv.id.slice(0, 8),
    dueDate: inv.due_date,
    balanceDue: opts.balance,
    currency: inv.currency ?? 'USD',
    tone: opts.tone,
    viewUrl: inv.public_token ? `${PORTAL_URL}/portal/i/${inv.public_token}` : undefined,
  });

  const recorded = new Set((inv.reminded_offsets ?? []).map(String));
  for (const o of opts.offsetsToRecord) recorded.add(String(o));

  const { error } = await supabaseAdmin
    .from('invoices')
    .update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: (inv.reminder_count ?? 0) + 1,
      reminded_offsets: [...recorded],
    })
    .eq('id', inv.id);
  if (error) {
    // The mail has gone. Failing here would make the caller think it had not,
    // and a retry would mail the client twice.
    console.error('[invoiceReminders] reminder sent but could not be recorded', inv.invoice_number, error);
  }

  await logActivity(
    opts.actorId ?? null,
    'sent',
    'invoice',
    inv.id,
    inv.invoice_number ?? inv.id.slice(0, 8),
    { event: 'reminder', tone: opts.tone, trigger: opts.trigger, to, balance: opts.balance },
  );

  return { to };
}

/**
 * The nightly sweep over everything outstanding.
 *
 * Returns a count so the daily tick can log something meaningful — the old job
 * logged only `{ reactivated: 0 }`, which is why nobody could tell from the
 * logs that reminders had quietly stopped going out months earlier.
 */
export async function sweepClientReminders(): Promise<{ sent: number; considered: number }> {
  if (!mailerConfigured) return { sent: 0, considered: 0 };
  const today = todayUTC();

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(billing_contact_email, billing_contact_name, contact_email, contact_name, company_name)')
    .eq('doc_type', 'invoice')
    .in('status', OUTSTANDING_STATUSES);

  if (error) {
    console.error('[invoiceReminders] could not read outstanding invoices', error);
    return { sent: 0, considered: 0 };
  }

  let sent = 0;
  const considered = (data ?? []).length;

  for (const inv of data ?? []) {
    const balance = balanceOf(inv);
    if (balance <= 0.005) continue;

    // daysBetween(today, due) > 0 means due is in the future.
    const offset = -daysBetween(today, inv.due_date);
    const due = pickReminderOffsets(offset, inv.reminded_offsets ?? []);
    if (due.length === 0) continue;

    // One reminder per invoice per day, as protection against a double
    // EventBridge invocation. A milestone deferred by a day is picked up by
    // the next run, because what has been sent is now recorded per milestone
    // rather than inferred from the date.
    if (inv.last_reminder_at && String(inv.last_reminder_at).slice(0, 10) === today) continue;

    const { to } = recipientOf(inv.clients);
    if (!to) continue;

    try {
      await sendReminderFor(inv, inv.clients, {
        tone: toneFor(offset),
        offsetsToRecord: due,
        trigger: 'nightly',
        balance,
      });
      sent++;
    } catch (err) {
      console.error('[invoiceReminders] reminder email failed for', inv.invoice_number, err);
    }
  }

  return { sent, considered };
}

/**
 * "Send reminder now", from the invoice screen.
 *
 * Deliberately records NO milestone: a reminder somebody chose to send is not
 * one of the scheduled nudges, so the automatic cadence carries on unchanged
 * afterwards. The alternative — consuming the next milestone — would mean a
 * manual chase quietly cancelled the next automatic one.
 */
export async function sendInvoiceReminderNow(
  invoiceId: string,
  actorId?: string,
): Promise<{ sent: true; to: string; tone: ReminderTone; reminderCount: number }> {
  const { data: inv, error } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(billing_contact_email, billing_contact_name, contact_email, contact_name, company_name)')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) throw error;
  if (!inv) throw new NotFoundError('Invoice not found.');

  if (inv.doc_type === 'estimate') {
    throw new ValidationError('An estimate has no payment due, so there is nothing to remind the client about.');
  }
  if (!OUTSTANDING_STATUSES.includes(inv.status)) {
    throw new ValidationError(
      inv.status === 'draft'
        ? 'This invoice has not been sent to the client yet. Send the invoice first.'
        : 'This invoice is settled, so there is nothing outstanding to remind the client about.',
    );
  }

  const balance = balanceOf(inv);
  if (balance <= 0.005) {
    throw new ValidationError('This invoice has nothing outstanding, so there is nothing to remind the client about.');
  }
  if (!mailerConfigured) {
    throw new ValidationError('Email is not configured on this environment, so no reminder can be sent.');
  }

  const offset = -daysBetween(todayUTC(), inv.due_date);
  const tone = toneFor(offset);

  const { to } = await sendReminderFor(inv, inv.clients, {
    tone, offsetsToRecord: [], trigger: 'manual', actorId, balance,
  });

  return { sent: true, to, tone, reminderCount: (inv.reminder_count ?? 0) + 1 };
}
