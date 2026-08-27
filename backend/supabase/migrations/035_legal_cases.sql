-- Legal case management: Cases (per-employee immigration matters), Filings
-- (CAP registration / PWD sub-records on a case), Case Notes (a timestamped
-- comment thread), and Support Tickets (HR/Admin -> Legal request queue).
-- Extends the `legal` role from migration 034 beyond document review.

CREATE TYPE case_type AS ENUM (
  'h1b_new', 'h1b_extension', 'h1b_transfer', 'perm_green_card',
  'opt_stem_extension', 'tn_renewal', 'l1_extension', 'other'
);

CREATE TYPE case_status AS ENUM (
  'open', 'pending_uscis', 'rfe_received', 'case_approved', 'denied', 'closed'
);

CREATE TYPE filing_type AS ENUM ('cap_registration', 'pwd');

CREATE TYPE filing_status AS ENUM (
  'draft', 'filed', 'certified', 'selected', 'not_selected', 'denied', 'withdrawn'
);

CREATE TYPE ticket_status AS ENUM ('new', 'in_progress', 'resolved');

CREATE SEQUENCE case_seq START 1;
CREATE SEQUENCE filing_seq START 1;
CREATE SEQUENCE ticket_seq START 1;

CREATE TABLE cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id      TEXT NOT NULL UNIQUE DEFAULT generate_display_id('CASE-', 'case_seq'),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  case_type       case_type NOT NULL,
  status          case_status NOT NULL DEFAULT 'open',
  receipt_number  TEXT,
  priority_date   DATE,
  filed_date      DATE,
  decision_date   DATE,
  attorney_name   TEXT,
  description     TEXT NOT NULL DEFAULT '',
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_cases_employee ON cases(employee_id);
CREATE INDEX idx_cases_status ON cases(status);

-- One table for both CAP Registration and PWD filings — they share an
-- identical lifecycle (attached to a case, submitted with a reference
-- number, tracked to a decision) and differ only in a few fields, which live
-- in `details`. Suggested (not schema-enforced) shapes:
--   cap_registration: { lotteryYear, capSeason, registrationNumber, selected }
--   pwd: { socCode, wageLevel, prevailingWageAmount, worksiteAddress }
CREATE TABLE case_filings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        TEXT NOT NULL UNIQUE DEFAULT generate_display_id('FIL-', 'filing_seq'),
  case_id           UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  filing_type       filing_type NOT NULL,
  status            filing_status NOT NULL DEFAULT 'draft',
  reference_number  TEXT,
  filed_date        DATE,
  decision_date     DATE,
  details           JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_case_filings_updated_at BEFORE UPDATE ON case_filings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_case_filings_case ON case_filings(case_id);

-- A real multi-entry timestamped thread (unlike the single-mutable-field
-- notes elsewhere in this app, e.g. client.internal_notes).
CREATE TABLE case_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  author_id   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_case_notes_case ON case_notes(case_id, created_at DESC);

CREATE TABLE support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id    TEXT NOT NULL UNIQUE DEFAULT generate_display_id('TCKT-', 'ticket_seq'),
  case_id       UUID REFERENCES cases(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        ticket_status NOT NULL DEFAULT 'new',
  resolution    TEXT,
  created_by    UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  resolved_by   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_tickets_target_chk CHECK (case_id IS NOT NULL OR employee_id IS NOT NULL)
);
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX idx_support_tickets_case ON support_tickets(case_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- Deny-all RLS safety net, matching every other table in this project — real
-- authorization is requireRole() + service-layer scoping in the backend,
-- which always queries via the service-role key (bypasses RLS entirely).
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON cases USING (false);
CREATE POLICY "service_role_only" ON case_filings USING (false);
CREATE POLICY "service_role_only" ON case_notes USING (false);
CREATE POLICY "service_role_only" ON support_tickets USING (false);
