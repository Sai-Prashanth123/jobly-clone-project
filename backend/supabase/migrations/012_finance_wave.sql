-- Wave-style finance/invoicing overhaul — data model.
--
-- Adds: manual line items + product catalog, P.O. / payment-terms / currency,
-- manual payments (partial + balance), estimates (doc_type), recurring invoice
-- templates, shareable public-view token + viewed tracking, and reminder state.
--
-- NOTE: the two new invoice_status enum values are added in a SEPARATE step
-- (applied first) because a freshly-added enum value can't be referenced in the
-- same transaction that adds it.

-- ── Step 1 (run first, on its own): extend the status enum ────────────────────
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- ── Step 2: catalog of reusable products/services ─────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'item',   -- hour | item | day | fixed
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Step 3: invoices — new Wave-style columns ────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS po_number            TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms        TEXT NOT NULL DEFAULT 'net_30',
  ADD COLUMN IF NOT EXISTS currency             TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS amount_paid          NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viewed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS public_token         TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS terms                TEXT,
  ADD COLUMN IF NOT EXISTS doc_type             TEXT NOT NULL DEFAULT 'invoice', -- invoice | estimate
  ADD COLUMN IF NOT EXISTS estimate_status      TEXT,                            -- draft|sent|viewed|accepted|declined|converted
  ADD COLUMN IF NOT EXISTS converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_template_id UUID,
  ADD COLUMN IF NOT EXISTS last_reminder_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_doc_type ON invoices(doc_type);

-- ── Step 4: invoice_line_items — manual-item fields ──────────────────────────
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS item_name  TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity   NUMERIC(10,2);

-- ── Step 5: manual payments (partial payments + balance) ─────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  paid_on     DATE NOT NULL,
  method      TEXT NOT NULL DEFAULT 'bank_transfer', -- bank_transfer|cheque|cash|card|other
  reference   TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ── Step 6: recurring invoice templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            TEXT,
  line_items       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{itemName,description,quantity,unitPrice}]
  tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
  po_number        TEXT,
  currency         TEXT NOT NULL DEFAULT 'USD',
  payment_terms    TEXT NOT NULL DEFAULT 'net_30',
  notes            TEXT,
  terms            TEXT,
  frequency        TEXT NOT NULL,                       -- daily|weekly|biweekly|monthly|quarterly|semiannual|yearly
  start_date       DATE NOT NULL,
  end_mode         TEXT NOT NULL DEFAULT 'never',        -- never|on_date|after_count
  end_date         DATE,
  max_occurrences  INT,
  occurrences_made INT NOT NULL DEFAULT 0,
  next_run_date    DATE NOT NULL,
  auto_send        BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'active',       -- active|paused
  created_by       UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_recurring_updated_at
  BEFORE UPDATE ON recurring_invoice_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_recurring_next_run ON recurring_invoice_templates(next_run_date) WHERE status = 'active';

-- Backfill: link the new FK from invoices.recurring_template_id (added above)
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_recurring_template
  FOREIGN KEY (recurring_template_id) REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL;
