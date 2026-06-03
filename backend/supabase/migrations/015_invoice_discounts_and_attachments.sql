-- 015_invoice_discounts_and_attachments.sql
-- Wave-style invoice editor: an optional document-level discount (percentage or
-- fixed amount, applied to the subtotal BEFORE tax) + file attachments.
--
-- Discount mirrors the existing tax_rate/tax_amount split: discount_value keeps
-- what the user typed (10 or 50) so the editor can re-show "%" vs "$"; while
-- discount_amount is the resolved dollar figure persisted for PDF/print/reports.
-- subtotal stays the raw line-item sum; tax_amount + total_amount are computed
-- on the discounted subtotal in the service layer.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type   TEXT,                               -- NULL | 'percentage' | 'fixed'
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- what the user entered
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;   -- resolved $ applied to subtotal

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_discount_type'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT chk_invoices_discount_type
      CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed'));
  END IF;
END $$;

-- Invoice attachments reuse the polymorphic `documents` table (entity_type
-- 'invoice') + the existing 'invoices' storage bucket. That bucket was created
-- (migration 001) allowing ONLY application/pdf for the cached invoice PDF.
-- Widen its accepted mime types to match ALLOWED_MIME_TYPES in
-- backend/src/middleware/upload.ts so finance can attach images / office docs.
-- Cached PDFs live at the bucket root ({invoice_number}.pdf) while attachments
-- live under {invoiceId}/{ts}-{name}, so they never collide.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]
WHERE id = 'invoices';
