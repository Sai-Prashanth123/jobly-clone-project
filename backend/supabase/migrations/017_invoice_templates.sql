-- 017_invoice_templates.sql
-- Selectable invoice "themes". A theme parameterizes the premium PDF/print
-- renderer (accent color, font, header style, footer text) rather than carrying
-- arbitrary layout code. Each invoice may point at a template; absent that, the
-- default theme is used. Route-layer RBAC (admin/finance); no RLS.

CREATE TABLE IF NOT EXISTS invoice_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  accent_color TEXT NOT NULL DEFAULT '#2563EB',          -- hex, recolors header/table/total
  font_family  TEXT NOT NULL DEFAULT 'Helvetica',        -- 'Helvetica' | 'Times-Roman' | 'Courier'
  header_style TEXT NOT NULL DEFAULT 'plain',            -- 'plain' | 'band'
  footer_text  TEXT NOT NULL DEFAULT 'Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com',
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_template_id UUID REFERENCES invoice_templates(id) ON DELETE SET NULL;

-- Seed three built-in themes (only if empty). Classic is the default and matches
-- the current premium look.
INSERT INTO invoice_templates (name, accent_color, font_family, header_style, footer_text, is_default)
SELECT * FROM (VALUES
  ('Classic', '#2563EB', 'Helvetica',   'plain', 'Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com', TRUE),
  ('Modern',  '#0F2942', 'Helvetica',   'band',  'Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com', FALSE),
  ('Minimal', '#111827', 'Times-Roman', 'plain', 'Thank you for your business — Jobly Solutions', FALSE)
) AS seed(name, accent_color, font_family, header_style, footer_text, is_default)
WHERE NOT EXISTS (SELECT 1 FROM invoice_templates);
