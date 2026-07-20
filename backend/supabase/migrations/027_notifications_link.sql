-- 027_notifications_link.sql
-- Notifications previously had no way to say "clicking this should go here" —
-- entity_type/entity_id are stored but don't map 1:1 to a route (the same
-- entity_type, e.g. 'employee', links to a different page depending on the
-- recipient's role: HR/admin go to /portal/employees/:id, the employee
-- themself goes to /portal/profile or /portal/onboarding/pending). Each
-- createNotification() call site already knows the recipient's role and the
-- correct destination, so the link is computed and stored there rather than
-- re-derived generically on the frontend from entity_type alone.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link TEXT;
