import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import { todayUTC, daysBetween } from '../lib/dateUtils';
import { sendInvoiceReminderEmail, mailerConfigured } from '../lib/mailer';
import { processDueRecurring } from '../services/recurring.service';
import { reactivateReturnedEmployees } from '../services/employees.service';
import {
  triggerTimesheetReminders,
  triggerContractExpiryAlerts,
  triggerDocumentExpiryAlerts,
} from '../services/notifications.service';

const PORTAL_URL = process.env.FRONTEND_URL ?? 'https://yellow-sea-0a9088500.6.azurestaticapps.net';

// Reminder offsets (days relative to the due date). Negative = before due.
//  -3 → "due in 3 days", 0 → "due today", +3/+7/+14 → overdue nudges.
const REMINDER_OFFSETS = [-3, 0, 3, 7, 14];

function round2(n: number): number { return Math.round(n * 100) / 100; }

// Flip sent/viewed invoices to overdue once past due, and email reminders on the
// policy offsets (one per invoice per day, deduped via last_reminder_at).
async function processReminders(): Promise<void> {
  const today = todayUTC();

  // 1. Mark overdue: real invoices, sent/viewed, due date in the past, with a balance.
  const { data: toOverdue } = await supabaseAdmin
    .from('invoices')
    .select('id, total_amount, amount_paid')
    .eq('doc_type', 'invoice')
    .in('status', ['sent', 'viewed'])
    .lt('due_date', today);
  for (const inv of toOverdue ?? []) {
    if (round2((inv.total_amount ?? 0) - (inv.amount_paid ?? 0)) > 0.005) {
      await supabaseAdmin.from('invoices').update({ status: 'overdue' }).eq('id', inv.id);
    }
  }

  if (!mailerConfigured) return; // can still flip overdue without a mailer

  // 2. Reminders for anything outstanding with a balance.
  const { data: outstanding } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(billing_contact_email, billing_contact_name, contact_email, contact_name, company_name)')
    .eq('doc_type', 'invoice')
    .in('status', ['sent', 'viewed', 'partially_paid', 'overdue']);

  for (const inv of outstanding ?? []) {
    const balance = round2((inv.total_amount ?? 0) - (inv.amount_paid ?? 0));
    if (balance <= 0.005) continue;

    // daysBetween(today, due) > 0 ⇒ due is in the future; offset compares to -days.
    const daysUntilDue = daysBetween(today, inv.due_date);   // +N before due, -N after
    const offset = -daysUntilDue; // 0 on due, +N overdue, -N upcoming
    if (!REMINDER_OFFSETS.includes(offset)) continue;

    // Dedupe: at most one reminder per invoice per day.
    if (inv.last_reminder_at && String(inv.last_reminder_at).slice(0, 10) === today) continue;

    const client = inv.clients;
    const to = client?.billing_contact_email || client?.contact_email;
    if (!to) continue;
    const contactName = client?.billing_contact_name || client?.contact_name || client?.company_name || 'there';
    const tone: 'upcoming' | 'due' | 'overdue' = offset < 0 ? 'upcoming' : offset === 0 ? 'due' : 'overdue';

    try {
      await sendInvoiceReminderEmail({
        to, contactName, invoiceNumber: inv.invoice_number, dueDate: inv.due_date,
        balanceDue: balance, currency: inv.currency ?? 'USD', tone,
        viewUrl: inv.public_token ? `${PORTAL_URL}/portal/i/${inv.public_token}` : undefined,
      });
      await supabaseAdmin.from('invoices').update({ last_reminder_at: new Date().toISOString() }).eq('id', inv.id);
    } catch (err) {
      console.error('[scheduler] reminder email failed for', inv.invoice_number, err);
    }
  }
}

// One daily tick. Exported so it can also be triggered manually (admin "Run now").
export async function runDailyTick(): Promise<{ recurring: number; reactivated: number }> {
  const recurring = await processDueRecurring();
  await processReminders();
  // Auto-reactivate employees whose extended-leave return date has arrived.
  const reactivated = await reactivateReturnedEmployees();

  // Notification sweeps that were previously admin-manual-trigger-only. Each is
  // isolated in its own try/catch so one failing job doesn't prevent the others
  // from running (same error-isolation intent as the per-invoice try/catch in
  // processReminders above).
  try {
    await triggerTimesheetReminders();
  } catch (err) {
    console.error('[scheduler] triggerTimesheetReminders failed', err);
  }
  try {
    await triggerContractExpiryAlerts();
  } catch (err) {
    console.error('[scheduler] triggerContractExpiryAlerts failed', err);
  }
  try {
    await triggerDocumentExpiryAlerts();
  } catch (err) {
    console.error('[scheduler] triggerDocumentExpiryAlerts failed', err);
  }

  return { recurring, reactivated };
}

// Boot the cron scheduler. Guarded by ENABLE_SCHEDULER so local dev / tests
// don't fire. Single Azure instance → no distributed lock needed.
export function startScheduler(): void {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('[scheduler] disabled (set ENABLE_SCHEDULER=true to enable)');
    return;
  }
  // 02:00 UTC daily.
  cron.schedule('0 2 * * *', () => {
    console.log('[scheduler] daily tick start', new Date().toISOString());
    runDailyTick().catch(err => console.error('[scheduler] daily tick failed', err));
  }, { timezone: 'UTC' });
  console.log('[scheduler] enabled — daily tick at 02:00 UTC');
}
