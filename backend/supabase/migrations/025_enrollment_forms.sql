-- 025_enrollment_forms.sql
-- New-hire benefits enrollment form (National General Benefits Solutions
-- "Employee Enrollment Form" reference document), employee-filled. Unlike
-- performance_reviews (admin fills, employee views), HR/admin only CREATES
-- the record (assigning it to an employee, prefilled from their profile);
-- the EMPLOYEE fills in the remaining fields themselves and submits, which
-- locks the record and generates the final PDF.
--
-- Sections A/B/D/E/F/G/I of the reference form are stored as one JSONB blob
-- (`form_data`) rather than ~60 dedicated columns, since none of these
-- fields need SQL-level filtering/reporting (contrast performance_reviews,
-- whose fields ARE queried). Section C (existing-group plan changes) does
-- not apply to new-hire enrollment and is intentionally not modeled.
-- Sections H and I's long legal paragraphs are static text, not stored —
-- see backend/src/lib/enrollmentFormText.ts.
--
-- form_data shape (mirrored exactly by backend/src/schemas/enrollmentForms.schema.ts):
-- {
--   sectionA: { lastName, firstName, mi, ssn, gender, birthDate, avgHoursWeek, dateEmployedFullTime,
--               homeAddress:{street,city,state,zip}, mailingSameAsHome, mailingAddress:{street,city,state,zip},
--               homePhone, workPhone, cellPhone, email, bestTimeToCall, jobTitle, maritalStatus,
--               employeeStatus, workScheduleType, cobraEffectiveDate, earningsBasis,
--               enrollmentType, qualifyingEventDate },
--   sectionB: { waiverReason, waiverReasonOther, signatureName, signatureDate },
--   sectionD: { coverageTier, dependents:[{lastName,firstName,relationship,gender,dob,ssn,tobaccoUse}] },
--   sectionE: { currentPlanActive, currentPlanFor, currentPlanCarrier, currentPlanId,
--               medicareA, medicareB, medicareD, medicareFor, medicareRemainsActive },
--   sectionF: { employee:{height,weight,motorcycle,movingViolation,dui}, spouse:{...same},
--               conditions: string[], otherUndiagnosed, advisedFutureTreatment,
--               currentlyPregnant, dueDate, cSection, multiples, pregnancyComplications,
--               medicationsLast18Months },
--   sectionG: [{ person, condition, datesTreated, treatment, dateLastTaken, prognosis }],
--   sectionI: { signatureName, signatureDate }
-- }

CREATE SEQUENCE IF NOT EXISTS enrollment_form_seq START 1;

CREATE TABLE enrollment_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id    TEXT NOT NULL UNIQUE DEFAULT generate_display_id('ENR-', 'enrollment_form_seq'),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),

  form_data     JSONB NOT NULL DEFAULT '{}',

  submitted_at  TIMESTAMPTZ,
  pdf_url       TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enrollment_forms_employee ON enrollment_forms(employee_id);
CREATE INDEX idx_enrollment_forms_status   ON enrollment_forms(status);

ALTER TABLE enrollment_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON enrollment_forms USING (false);

-- Private bucket for the generated enrollment-form PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('enrollment-forms', 'enrollment-forms', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
