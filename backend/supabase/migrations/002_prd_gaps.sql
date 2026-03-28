-- ─────────────────────────────────────────────────────────────────────────────
-- 002_prd_gaps.sql  — PRD compliance additions
-- Run this in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Timesheet comments field
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Invoice billing period
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end   DATE;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'info',   -- info | warning | error | success
  entity_type  TEXT,                            -- timesheet | invoice | employee | client
  entity_id    UUID,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- 4. Activity / audit log
CREATE TABLE IF NOT EXISTS activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,        -- created | updated | deleted | status_changed
  entity_type  TEXT NOT NULL,        -- employee | client | assignment | timesheet | invoice
  entity_id    UUID NOT NULL,
  entity_label TEXT,                 -- EMP-0001, INV-2026-0001, etc.
  metadata     JSONB,                -- diff or extra context
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor  ON activity_logs(actor_id, created_at DESC);
