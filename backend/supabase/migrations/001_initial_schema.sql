-- ============================================================
-- Jobly Solutions — Initial Schema
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE user_role          AS ENUM ('admin','hr','operations','finance','employee');
CREATE TYPE employee_status    AS ENUM ('active','inactive','onboarding');
CREATE TYPE employment_type    AS ENUM ('full_time','part_time','contract','w2','1099','c2c','vendor');
CREATE TYPE visa_type          AS ENUM ('h1b','l1','opt','stem_opt','tn','gc','citizen','other');
CREATE TYPE i9_status          AS ENUM ('pending','complete','expired');
CREATE TYPE pay_type           AS ENUM ('hourly','salary');
CREATE TYPE pay_frequency      AS ENUM ('weekly','biweekly','monthly');
CREATE TYPE billing_type       AS ENUM ('hourly','monthly','milestone');
CREATE TYPE assignment_status  AS ENUM ('active','completed','pending','terminated');
CREATE TYPE timesheet_status   AS ENUM ('draft','submitted','manager_approved','client_approved','rejected');
CREATE TYPE invoice_status     AS ENUM ('draft','sent','paid','overdue');
CREATE TYPE entity_type        AS ENUM ('employee','client','invoice');

-- ── Auto-increment display ID helper ─────────────────────────

CREATE SEQUENCE employee_seq    START 1;
CREATE SEQUENCE client_seq      START 1;
CREATE SEQUENCE assignment_seq  START 1;
CREATE SEQUENCE timesheet_seq   START 1;
CREATE SEQUENCE invoice_seq     START 1;

CREATE OR REPLACE FUNCTION generate_display_id(prefix TEXT, seq_name TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN prefix || LPAD(nextval(seq_name)::TEXT, 4, '0');
END;
$$;

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── portal_users ─────────────────────────────────────────────

CREATE TABLE portal_users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  role             user_role NOT NULL DEFAULT 'employee',
  employee_id      UUID,          -- populated after employee record is created
  avatar_initials  TEXT NOT NULL DEFAULT '?',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_portal_users_updated_at
  BEFORE UPDATE ON portal_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── employees ────────────────────────────────────────────────

CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id            TEXT NOT NULL UNIQUE DEFAULT generate_display_id('EMP-', 'employee_seq'),
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 TEXT NOT NULL DEFAULT '',
  dob                   DATE,
  address_street        TEXT NOT NULL DEFAULT '',
  address_city          TEXT NOT NULL DEFAULT '',
  address_state         TEXT NOT NULL DEFAULT '',
  address_zip           TEXT NOT NULL DEFAULT '',
  address_country       TEXT NOT NULL DEFAULT 'US',
  department            TEXT NOT NULL,
  job_title             TEXT NOT NULL,
  employment_type       employment_type NOT NULL DEFAULT 'contract',
  start_date            DATE NOT NULL,
  manager_id            UUID REFERENCES employees(id) ON DELETE SET NULL,
  status                employee_status NOT NULL DEFAULT 'onboarding',
  visa_type             visa_type,
  visa_expiry           DATE,
  i9_status             i9_status,
  pay_rate              NUMERIC(10,2) NOT NULL DEFAULT 0,
  pay_type              pay_type NOT NULL DEFAULT 'hourly',
  pay_frequency         pay_frequency NOT NULL DEFAULT 'biweekly',
  work_location         TEXT,
  ssn                   TEXT,
  payment_type          TEXT,
  bank_name             TEXT,
  bank_routing_number   TEXT,
  bank_account_number   TEXT,
  tax_form_type         TEXT,
  reporting_manager_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_employees_status  ON employees(status);
CREATE INDEX idx_employees_dept    ON employees(department);
CREATE INDEX idx_employees_email   ON employees(email);

-- ── clients ──────────────────────────────────────────────────

CREATE TABLE clients (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id             TEXT NOT NULL UNIQUE DEFAULT generate_display_id('CLT-', 'client_seq'),
  company_name           TEXT NOT NULL,
  contact_name           TEXT NOT NULL,
  contact_email          TEXT NOT NULL,
  contact_phone          TEXT,
  industry               TEXT NOT NULL DEFAULT '',
  address_street         TEXT NOT NULL DEFAULT '',
  address_city           TEXT NOT NULL DEFAULT '',
  address_state          TEXT NOT NULL DEFAULT '',
  address_zip            TEXT NOT NULL DEFAULT '',
  address_country        TEXT NOT NULL DEFAULT 'US',
  contract_start_date    DATE NOT NULL,
  contract_end_date      DATE,
  net_payment_days       INT NOT NULL DEFAULT 30,
  default_bill_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency               TEXT NOT NULL DEFAULT 'USD',
  billing_type           billing_type,
  billing_contact_name   TEXT,
  billing_contact_email  TEXT,
  billing_contact_phone  TEXT,
  billing_street         TEXT,
  billing_city           TEXT,
  billing_state          TEXT,
  billing_zip            TEXT,
  billing_country        TEXT,
  tax_id                 TEXT,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_clients_status ON clients(status);

-- ── assignments ───────────────────────────────────────────────

CREATE TABLE assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id            TEXT NOT NULL UNIQUE DEFAULT generate_display_id('ASN-', 'assignment_seq'),
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_name          TEXT NOT NULL,
  role                  TEXT NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE,
  bill_rate             NUMERIC(10,2) NOT NULL DEFAULT 0,
  pay_rate              NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_hours_per_week    INT NOT NULL DEFAULT 40,
  status                assignment_status NOT NULL DEFAULT 'pending',
  billing_type          billing_type,
  work_location         TEXT,
  reporting_manager_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_assignments_employee ON assignments(employee_id);
CREATE INDEX idx_assignments_client   ON assignments(client_id);
CREATE INDEX idx_assignments_status   ON assignments(status);

-- ── timesheets ────────────────────────────────────────────────

CREATE TABLE timesheets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id            TEXT NOT NULL UNIQUE DEFAULT generate_display_id('TS-', 'timesheet_seq'),
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id         UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start_date       DATE NOT NULL,
  week_end_date         DATE NOT NULL,
  total_hours           NUMERIC(6,2) NOT NULL DEFAULT 0,
  status                timesheet_status NOT NULL DEFAULT 'draft',
  submitted_at          TIMESTAMPTZ,
  manager_approved_at   TIMESTAMPTZ,
  client_approved_at    TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, assignment_id, week_start_date)
);

CREATE TRIGGER trg_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_timesheets_employee   ON timesheets(employee_id);
CREATE INDEX idx_timesheets_client     ON timesheets(client_id);
CREATE INDEX idx_timesheets_status     ON timesheets(status);
CREATE INDEX idx_timesheets_week       ON timesheets(week_start_date);

-- ── timesheet_entries ─────────────────────────────────────────

CREATE TABLE timesheet_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id  UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL,
  day_of_week   TEXT NOT NULL,
  hours         NUMERIC(4,2) NOT NULL DEFAULT 0,
  is_billable   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (timesheet_id, entry_date)
);

CREATE INDEX idx_entries_timesheet ON timesheet_entries(timesheet_id);

-- ── invoices ─────────────────────────────────────────────────

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  issue_date      DATE NOT NULL,
  due_date        DATE NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          invoice_status NOT NULL DEFAULT 'draft',
  pdf_url         TEXT,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ── invoice_line_items ────────────────────────────────────────

CREATE TABLE invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  timesheet_id  UUID REFERENCES timesheets(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
  bill_rate     NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ── invoice_timesheets (junction) ─────────────────────────────

CREATE TABLE invoice_timesheets (
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  timesheet_id  UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  PRIMARY KEY (invoice_id, timesheet_id)
);

-- ── documents ─────────────────────────────────────────────────

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  storage_url   TEXT,
  uploaded_by   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);

-- ── Supabase Storage Buckets ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('employee-docs', 'employee-docs', false, 20971520, NULL),
  ('client-docs',   'client-docs',   false, 20971520, NULL),
  ('invoices',      'invoices',      false, 20971520, ARRAY['application/pdf']);

-- ── RLS ───────────────────────────────────────────────────────
-- Backend uses service role key which bypasses RLS.
-- These policies protect direct anon/authenticated client access.

ALTER TABLE portal_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;

-- Only service role (backend) can access — no direct client access
CREATE POLICY "service_role_only" ON portal_users       USING (false);
CREATE POLICY "service_role_only" ON employees          USING (false);
CREATE POLICY "service_role_only" ON clients            USING (false);
CREATE POLICY "service_role_only" ON assignments        USING (false);
CREATE POLICY "service_role_only" ON timesheets         USING (false);
CREATE POLICY "service_role_only" ON timesheet_entries  USING (false);
CREATE POLICY "service_role_only" ON invoices           USING (false);
CREATE POLICY "service_role_only" ON invoice_line_items USING (false);
CREATE POLICY "service_role_only" ON invoice_timesheets USING (false);
CREATE POLICY "service_role_only" ON documents          USING (false);
