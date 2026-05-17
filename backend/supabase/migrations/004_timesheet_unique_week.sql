-- Prevents two concurrent createTimesheet calls (e.g. user with two browser
-- tabs open) from inserting two timesheets for the same employee/assignment/
-- week. The pre-insert SELECT in createTimesheet has a race window; this
-- partial unique index closes it at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS timesheets_unique_emp_asn_week
  ON public.timesheets (employee_id, assignment_id, week_start_date)
  WHERE deleted_at IS NULL;
