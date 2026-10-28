import cron from 'node-cron';
import { sendCustomEmail, mailerConfigured } from '../lib/mailer';
import { markOverdueInvoices, sweepClientReminders } from '../services/invoiceReminders.service';
import { BILLING_EMAIL } from '../lib/billing';
import { reactivateReturnedEmployees } from '../services/employees.service';
import {
  triggerTimesheetReminders,
  triggerContractExpiryAlerts,
  triggerDocumentExpiryAlerts,
  notifyRoles,
} from '../services/notifications.service';

function round2(n: number): number { return Math.round(n * 100) / 100; }

// Mark overdue, tell the people inside, then chase the client.
//
// The deciding logic lives in services/invoiceReminders.service.ts so the
// nightly run and the "Send reminder" button on an invoice cannot drift apart.
// What stays here is the part that is nightly by nature: the internal
// notification and the AP digest both fire on the TRANSITION to overdue, which
// happens once per invoice, and firing them from a manual send would turn them
// into the nightly repetition the document-expiry alerts had to be rescued from.
async function processReminders(): Promise<{ overdue: number; remindersSent: number }> {
  const wentOverdue = await markOverdueInvoices();

  // Tell finance. Until this existed the only thing that happened when an
  // invoice went overdue was an email to the CLIENT — nobody internal was told
  // at all.
  for (const inv of wentOverdue) {
    try {
      await notifyRoles(
        ['admin', 'finance'],
        {
          title: 'Invoice Overdue',
          message: `Invoice ${inv.invoiceNumber} is overdue — ${inv.balance.toFixed(2)} outstanding, was due ${inv.dueDate}.`,
          type: 'warning',
          entityType: 'invoice',
          entityId: inv.id,
          link: `/portal/invoices/${inv.id}`,
        },
      );
    } catch (err) {
      console.error('[scheduler] overdue notification failed for', inv.invoiceNumber, err);
    }
  }

  // ...and one digest email to accounts payable, which is what HR actually
  // asked for ("Overdue invoice to be notified to ap@"). One message listing
  // everything that turned overdue today rather than one per invoice: on a bad
  // month that difference is a dozen emails against one.
  if (wentOverdue.length > 0 && mailerConfigured) {
    try {
      const rows = wentOverdue
        .map(i => `<tr><td style="padding:6px 12px;">${i.invoiceNumber}</td><td style="padding:6px 12px;">due ${i.dueDate}</td><td style="padding:6px 12px;text-align:right;">${i.balance.toFixed(2)}</td></tr>`)
        .join('');
      const total = round2(wentOverdue.reduce((sum, i) => sum + i.balance, 0));
      await sendCustomEmail({
        to: BILLING_EMAIL,
        subject: `${wentOverdue.length} invoice${wentOverdue.length === 1 ? '' : 's'} now overdue`,
        html: `<p>The following invoice${wentOverdue.length === 1 ? ' has' : 's have'} passed their due date with a balance outstanding.</p>
<table style="border-collapse:collapse;font-size:14px;">${rows}</table>
<p style="margin-top:14px;"><strong>Total outstanding: ${total.toFixed(2)}</strong></p>`,
      });
    } catch (err) {
      // Never let a failed digest stop the rest of the nightly tick.
      console.error('[scheduler] overdue digest email failed', err);
    }
  }

  if (wentOverdue.length > 0) {
    console.log(`[scheduler] ${wentOverdue.length} invoice(s) went overdue`);
  }

  const { sent, considered } = await sweepClientReminders();
  // Logged unconditionally. The old job logged nothing unless something went
  // overdue, so a sweep that had silently stopped sending anything months ago
  // was indistinguishable from a quiet night.
  console.log(`[scheduler] payment reminders: ${sent} sent, ${considered} invoice(s) considered`);

  return { overdue: wentOverdue.length, remindersSent: sent };
}

// One daily tick. Exported so it can also be triggered manually (admin "Run now").
export async function runDailyTick(): Promise<{ reactivated: number; overdue: number; remindersSent: number }> {
  const reminders = await processReminders();
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

  return { reactivated, ...reminders };
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
