-- 023_invoice_email_template.sql
-- Distinguishes "invoice" email templates from generic "general" (bulk client
-- blast) templates, and lets an invoice reference which one to send with —
-- mirrors the existing invoice_template_id (PDF theme) pattern from
-- 017_invoice_templates.sql.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'invoice'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;
