-- 057_invoice_reminder_tracking.sql
--
-- Two columns so the payment-reminder sweep can tell what it has already sent.
--
-- WHY THIS EXISTS
--
-- `last_reminder_at` records only that *a* reminder went out that day. It
-- cannot say *which* one, so the nightly sweep tested the day offset with an
-- exact equality against a fixed list ([-3, 0, 3, 7, 14]). Two consequences,
-- both observed in production:
--
--   1. The sequence ran out. Every outstanding invoice in the live database
--      had its last reminder on precisely due+14 and nothing afterwards —
--      five invoices, $65,155, between 59 and 111 days past due, silent for
--      over six weeks.
--   2. A missed night was lost for good. If the Lambda failed on day +7 the
--      invoice got nothing until +14, and nothing at all after that.
--
-- `reminded_offsets` records the milestones that have actually fired, so the
-- sweep can ask "which of these have I not done yet" instead of "is today
-- exactly one of these". That lets the cadence continue past +14 and lets a
-- missed run catch up — while sending ONE email rather than one per missed
-- milestone, because mailing a customer four times in a night is how a
-- reminder system gets switched off.
--
-- `reminder_count` is the plain running total, for the "last reminder sent …
-- (3 sent)" line on the invoice screen.
--
-- Deliberately NOT a child table: `activity_logs` already records every send
-- with its tone and trigger and already has an entity-scoped reader
-- (EntityAuditTrail). A table would duplicate that history at the cost of four
-- hand-edits to the pg_dump-shaped rds/schema.sql.
--
-- Applying this changes no behaviour on its own. The defaults mean every
-- existing invoice reads as "no milestone has fired yet", which is the correct
-- starting point for the new sweep: the first run after deploy re-engages the
-- invoices that went quiet, which is the whole point.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminded_offsets text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.invoices.reminder_count IS
  'How many payment reminders have gone to the client, nightly and manual combined.';

COMMENT ON COLUMN public.invoices.reminded_offsets IS
  'Which reminder milestones have already fired, as signed day offsets relative to the due date (''-3'', ''0'', ''7'', ''28''). Membership is tested in JS over a handful of values, so no index is needed.';
