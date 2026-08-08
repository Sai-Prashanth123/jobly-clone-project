-- 031_invoice_timesheets_unique.sql
-- The existing PK (invoice_id, timesheet_id) only blocks duplicates within
-- ONE invoice; nothing stopped the same timesheet_id being billed on TWO
-- different invoices under concurrent "Generate Invoice" clicks (the app-level
-- pre-check in generateInvoice() has a race window). This constraint closes
-- that hole at the DB level.

ALTER TABLE invoice_timesheets
  ADD CONSTRAINT invoice_timesheets_timesheet_id_unique UNIQUE (timesheet_id);
