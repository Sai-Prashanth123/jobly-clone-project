-- Add created_by FK to main entity tables so we can show "Created by [Name/Role]"
-- on list views. Nullable because existing records predate this column.

ALTER TABLE employees    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES portal_users(id) ON DELETE SET NULL;
ALTER TABLE clients      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES portal_users(id) ON DELETE SET NULL;
ALTER TABLE assignments  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES portal_users(id) ON DELETE SET NULL;
ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES portal_users(id) ON DELETE SET NULL;

-- Index for join performance on list queries
CREATE INDEX IF NOT EXISTS idx_employees_created_by   ON employees(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_created_by     ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by    ON invoices(created_by);

-- Backfill from activity_logs where a 'created' event was recorded with an actor.
UPDATE employees e
SET created_by = al.actor_id
FROM activity_logs al
WHERE al.entity_type = 'employee' AND al.entity_id = e.id AND al.action = 'created' AND al.actor_id IS NOT NULL
  AND e.created_by IS NULL;

UPDATE invoices i
SET created_by = al.actor_id
FROM activity_logs al
WHERE al.entity_type = 'invoice' AND al.entity_id = i.id AND al.action = 'created' AND al.actor_id IS NOT NULL
  AND i.created_by IS NULL;
