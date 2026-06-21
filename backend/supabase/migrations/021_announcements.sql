-- Migration 021: Announcements Board
-- Admin/HR can post company announcements visible to all roles on their dashboards.
-- Supports pinning, type badges (info/urgent/event/policy), role targeting, and expiry.

CREATE SEQUENCE IF NOT EXISTS announcement_seq START 1;

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id   TEXT        NOT NULL UNIQUE DEFAULT generate_display_id('ANN-', 'announcement_seq'),
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'info'
               CHECK (type IN ('info', 'urgent', 'event', 'policy')),
  is_pinned    BOOLEAN     NOT NULL DEFAULT false,
  -- empty array = visible to all roles; populated = only those roles see it
  target_roles TEXT[]      NOT NULL DEFAULT '{}',
  author_id    UUID        REFERENCES portal_users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_announcements_pinned   ON announcements(is_pinned) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_created  ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires  ON announcements(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON announcements;
CREATE POLICY "service_role_only" ON announcements USING (false);
