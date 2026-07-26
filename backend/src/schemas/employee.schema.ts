import { z } from 'zod';

// Education + work-history rows stored as JSONB. Loose validation here —
// the UI is the source of truth for required fields per row and we don't
// want partial data on an existing employee to block an update.
export const educationEntrySchema = z.object({
  level: z.string().optional().default(''),
  specialization: z.string().optional().default(''),
  institution: z.string().optional().default(''),
  passYear: z.string().optional().default(''),
  gradeOrGPA: z.string().optional().default(''),
  mode: z.string().optional().default(''),
});

export const workHistoryEntrySchema = z.object({
  company: z.string().optional().default(''),
  jobTitle: z.string().optional().default(''),
  fromDate: z.string().optional().default(''),
  toDate: z.string().optional().default(''),
  reasonForLeaving: z.string().optional().default(''),
  lastAnnualSalary: z.number().nullable().optional(),
});

// US-issued identity documents (driver's license, passport, etc.). Numbers
// only — file scans go in the documents table tagged with the matching type.
export const identityDocumentEntrySchema = z.object({
  type: z.string(),       // 'ssn' | 'driver_license' | 'state_id' | 'passport' | 'ead' | 'green_card' | 'other'
  number: z.string().optional().default(''),
  state: z.string().optional().default(''),    // e.g. issuing state for DL/State ID
  expiry: z.string().optional().default(''),   // for passport / EAD
});

const permanentAddressSchema = z.object({
  street: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
  country: z.string().optional().default('US'),
}).optional().nullable();

const emergencyContactSchema = z.object({
  name: z.string().optional().default(''),
  relationship: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  altPhone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
}).optional().nullable();

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  // HR only needs to provide first name, last name, and personal email at
  // creation — every other field is optional and is completed by the employee
  // during self-onboarding (or by HR later).
  dob: z.string().optional().nullable(),
  address: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    zip: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }).optional(),
  department: z.string().optional().default('').transform(v => v.trim()),
  jobTitle: z.string().optional().default(''),
  employmentType: z.enum(['full_time','part_time','contract','w2','1099','c2c','vendor']).optional(),
  startDate: z.string().optional(),
  status: z.enum(['active','inactive','onboarding']).default('onboarding'),
  visaType: z.enum(['h1b','l1','opt','stem_opt','tn','gc','citizen','other']).optional().nullable(),
  visaExpiry: z.string().optional().nullable(),
  i9Status: z.enum(['pending','complete','expired']).optional().nullable(),
  payRate: z.number().min(0).optional(),
  payType: z.enum(['hourly','salary']).optional(),
  workLocation: z.string().optional().nullable(),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in XXX-XX-XXXX format').or(z.literal('')).optional().nullable(),
  paymentType: z.enum(['w2','1099','c2c']).optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankRoutingNumber: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  taxFormType: z.enum(['w4','w9']).optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workEmail: z.string().email().optional().nullable(),

  // ── Onboarding-form extension fields (all optional) ────────────────────
  middleName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  languagesKnown: z.string().optional().nullable(),
  profilePhotoUrl: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  skypeId: z.string().optional().nullable(),
  permanentAddress: permanentAddressSchema,
  emergencyContact: emergencyContactSchema,
  education: z.array(educationEntrySchema).optional().default([]),
  workHistory: z.array(workHistoryEntrySchema).optional().default([]),
  totalExperienceYears: z.number().nullable().optional(),
  experienceLevel: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  identityDocuments: z.array(identityDocumentEntrySchema).optional().default([]),
});

// Update keeps every field optional and lenient — pre-existing employees
// may have NULL values in newly-required fields, so we don't want stricter
// validation to block edits.
export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dob: z.string().optional().transform(v => v || undefined),
  address: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    zip: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }).optional(),
  department: z.string().optional().transform(v => v?.trim()),
  jobTitle: z.string().optional(),
  employmentType: z.enum(['full_time','part_time','contract','w2','1099','c2c','vendor']).optional(),
  startDate: z.string().optional(),
  status: z.enum(['active','inactive','onboarding']).optional(),
  visaType: z.enum(['h1b','l1','opt','stem_opt','tn','gc','citizen','other']).optional().nullable(),
  visaExpiry: z.string().optional().nullable().transform(v => v || null),
  i9Status: z.enum(['pending','complete','expired']).optional().nullable(),
  payRate: z.number().min(0).optional(),
  payType: z.enum(['hourly','salary']).optional(),
  workLocation: z.string().optional().nullable(),
  ssn: z.string().optional().nullable(),
  paymentType: z.enum(['w2','1099','c2c']).optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankRoutingNumber: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  taxFormType: z.enum(['w4','w9']).optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workEmail: z.string().email().optional().nullable(),
  // HR-only: once true, system emails stop going to the personal `email` and
  // only go to `workEmail` — see backend/src/lib/employeeCommunication.ts.
  blockPersonalEmail: z.boolean().optional(),

  // Same extension fields, all optional + nullable for partial updates.
  middleName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  languagesKnown: z.string().optional().nullable(),
  profilePhotoUrl: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  skypeId: z.string().optional().nullable(),
  permanentAddress: permanentAddressSchema,
  emergencyContact: emergencyContactSchema,
  education: z.array(educationEntrySchema).optional(),
  workHistory: z.array(workHistoryEntrySchema).optional(),
  totalExperienceYears: z.number().nullable().optional(),
  experienceLevel: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  identityDocuments: z.array(identityDocumentEntrySchema).optional(),
  // Optimistic-concurrency guard for onboarding approval — NOT persisted.
  // The onboarding_completed_at the approver reviewed; updateEmployee rejects
  // the approval with 409 if the employee re-submitted/reopened since.
  expectedOnboardingCompletedAt: z.string().nullable().optional(),
});

// Part B — place an employee on extended leave. Both dates are YYYY-MM-DD;
// cross-field ordering (return > start, return in the future) is enforced in
// the service so it can compare against today in UTC.
export const placeOnLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'returnDate must be YYYY-MM-DD'),
  reason: z.string().max(500).optional().nullable(),
});

// Part C — terminate an employee (disable login, keep record). effectiveDate
// defaults to today in the service when omitted.
export const terminateEmployeeSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD').optional().nullable(),
});

export const listEmployeesQuerySchema = z.object({
  status: z.enum(['active','inactive','onboarding']).optional(),
  department: z.string().optional().transform(v => v?.trim()),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type PlaceOnLeaveInput = z.infer<typeof placeOnLeaveSchema>;
export type TerminateEmployeeInput = z.infer<typeof terminateEmployeeSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type EducationEntryInput = z.infer<typeof educationEntrySchema>;
export type WorkHistoryEntryInput = z.infer<typeof workHistoryEntrySchema>;
export type IdentityDocumentEntryInput = z.infer<typeof identityDocumentEntrySchema>;
