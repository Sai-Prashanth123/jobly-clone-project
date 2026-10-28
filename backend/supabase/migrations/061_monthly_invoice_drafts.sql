-- Auto-assembled invoice drafts are cut per billing month, not per client.
--
-- 060 allowed exactly one open auto-draft per client, on the reasoning that two
-- would split a week's work across invoices. True, but it made the draft
-- unbounded in the other direction: every approved, unbilled sheet joined the
-- same invoice however old it was, and one client with a backlog assembled 51
-- timesheets across 14 months into a single $85,920 draft. Nobody sends that.
--
-- The sync now keys a draft on (client, month-of-week_start_date) and writes
-- billing_period_start as the first of that month, so this index is what keeps
-- the one-draft-per-month rule honest even if two approvals race.

DROP INDEX IF EXISTS public.invoices_one_open_auto_draft_per_client;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_open_auto_draft_per_client_month
  ON public.invoices (client_id, billing_period_start)
  WHERE auto_generated AND status = 'draft' AND doc_type = 'invoice';

COMMENT ON INDEX public.invoices_one_open_auto_draft_per_client_month IS
  'One open auto-draft per client per billing month. billing_period_start is always the 1st for an auto-draft, so this is a month key.';
