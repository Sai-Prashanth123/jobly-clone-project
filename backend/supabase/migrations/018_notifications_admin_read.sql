-- 018_notifications_admin_read.sql
-- Notifications are per-recipient rows (each owns its own `read` flag). Admins
-- should see EVERY notification in the system, but with their OWN read state —
-- separate from the recipient's. `admin_read` tracks whether an admin has read a
-- notification; the admin list/count/mark-read paths use this column, while every
-- other role keeps using `read` filtered by user_id (unchanged).

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS admin_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Speeds the admin "all unread" count.
CREATE INDEX IF NOT EXISTS idx_notifications_admin_read
  ON notifications(admin_read) WHERE admin_read = FALSE;
