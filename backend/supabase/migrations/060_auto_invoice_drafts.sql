-- 060_auto_invoice_drafts.sql
--
-- Draft invoices that assemble themselves as timesheets are approved.
--
-- WHY
--
-- Invoicing is manual today: somebody opens Invoices → New, picks the client,
-- ticks the approved timesheets, saves, then sends. Everything needed to do
-- that automatically already exists — generateInvoice builds the line items
-- from timesheet IDs, invoice_timesheets records which sheets are on which
-- invoice, and triggerInvoiceReadinessReminders already finds approved
-- timesheets that nobody has invoiced yet. Only the wiring was missing.
--
-- The chosen model is one OPEN DRAFT per client that accumulates: when a
-- project manager approves a timesheet it joins that client's draft, and the
-- draft is recomputed from the full set of linked sheets rather than patched
-- incrementally — recomputing from the truth cannot drift, and an approval
-- that is later reversed simply drops back out.
--
-- THREE COLUMNS
--
-- auto_generated       marks a draft this process owns. Without it the sync
--                      could not tell its own draft from one finance typed by
--                      hand, and would append timesheets to somebody's
--                      manual invoice.
--
-- blockers             what is wrong with the draft, as text: a missing bill
--                      rate, a timesheet with no client-signed proof, a client
--                      with no billing email. The decision was to still create
--                      the invoice and flag the problem, because a client
--                      skipped silently goes unbilled for weeks.
--
-- blockers_ack_at      when a human looked at those blockers and chose to send
--                      anyway. Sending is refused while blockers exist and
--                      this is null, so the flag is a gate rather than
--                      decoration — but it is a human's gate to open, not a
--                      permanent refusal.
--
-- text[] and timestamptz are both in the decided type set that
-- schemaTypes.test.ts enforces.
--
-- Applying this changes nothing on its own: every existing invoice has
-- auto_generated = false and no blockers, so the send path behaves exactly as
-- it does today until the sync starts creating drafts.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS blockers text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS blockers_ack_at timestamptz;

COMMENT ON COLUMN public.invoices.auto_generated IS
  'True for a draft assembled by the timesheet-approval sync. Only these are appended to automatically; a hand-made invoice is never touched.';

COMMENT ON COLUMN public.invoices.blockers IS
  'Problems found while assembling the draft (missing bill rate, unsigned timesheet, no billing email). Sending is refused while this is non-empty and blockers_ack_at is null.';

COMMENT ON COLUMN public.invoices.blockers_ack_at IS
  'When somebody reviewed the blockers and accepted them. Clears the send block without clearing the record of what was wrong.';

-- One open auto-draft per client is the whole model; two would split a week's
-- work across invoices and the sync would append to an arbitrary one.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_open_auto_draft_per_client
  ON public.invoices (client_id)
  WHERE auto_generated AND status = 'draft' AND doc_type = 'invoice';
