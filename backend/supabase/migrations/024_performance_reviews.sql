-- 024_performance_reviews.sql
-- Replaces the old self+manager review-cycle model (review_cycles /
-- review_participants — confirmed 0 rows in production, safe to drop) with
-- a single admin-authored "Employee Performance Appraisal Report" per
-- employee per period, matching the reference document format exactly:
-- period covered, employee/supervisor info, narrative sections, a 12-item
-- 1-5 rating grid, a job-function/weight/status/complete block, and a
-- signatures section. Downloadable as a branded PDF and emailed to the
-- employee — no self-assessment submission step in this model.

-- peer_feedback_requests was never referenced by any migration or app code
-- (an out-of-band table from the same old review-cycle model) — confirmed
-- 0 rows live before dropping.
DROP TABLE IF EXISTS peer_feedback_requests;
DROP TABLE IF EXISTS review_participants;
DROP TABLE IF EXISTS review_cycles;

CREATE SEQUENCE IF NOT EXISTS performance_review_seq START 1;

CREATE TABLE performance_reviews (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id              TEXT NOT NULL UNIQUE DEFAULT generate_display_id('PR-', 'performance_review_seq'),
  employee_id             UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_by              UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),

  period_start            DATE NOT NULL,
  period_end              DATE NOT NULL,

  salutation              TEXT,
  employee_number         TEXT,
  title_payroll_title     TEXT,
  employee_type           TEXT,
  supervisor_name         TEXT,
  supervised_full_period  BOOLEAN NOT NULL DEFAULT true,
  supervised_months       INT,

  job_related_performance TEXT,
  overall_evaluation      TEXT,

  -- 12 fixed criteria, each rated 1-5 — see RATING_CRITERIA in
  -- backend/src/schemas/performanceReviews.schema.ts for the canonical key list.
  ratings                 JSONB NOT NULL DEFAULT '{}',

  job_function            TEXT,
  weight_percent          NUMERIC(5,2) DEFAULT 100,
  status_goal             TEXT,
  complete_percent        NUMERIC(5,2) DEFAULT 100,

  performance_evaluation  TEXT,
  future_goals            TEXT,

  employee_signed_date    DATE,
  supervisor_signed_date  DATE,

  pdf_url                 TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_status ON performance_reviews(status);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON performance_reviews USING (false);

-- Private bucket for the generated appraisal-report PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('performance-reviews', 'performance-reviews', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
