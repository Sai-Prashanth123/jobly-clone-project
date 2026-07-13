import { z } from 'zod';

// Shared option lists — kept in sync with src/portal/hooks/useEnrollmentForms.ts
// on the frontend (same pattern as RATING_CRITERIA in performanceReviews.schema.ts).

export const CONDITION_CHECKLIST = [
  'AIDS or HIV',
  'Alcohol or Drug Use, Abuse, or Dependency',
  'Arthritis or other Skeletal Disorder',
  'Back Disorders',
  'Blood Disorders (including anemia)',
  'Cancer or Tumor',
  'Chest Pain',
  'Diabetes Mellitus',
  'Digestive Disorders',
  'Ear/Eye/Nose/Throat Disorders',
  'Endocrine Disorders',
  'Fracture/Broken Bone',
  'Heart Disorders',
  'High Cholesterol',
  'High Blood Pressure',
  "Hodgkin's/Lymphoma/Leukemia",
  'Immune Disorders',
  'Infertility',
  'Kidney Disorders',
  'Knee Injury or Disorder',
  'Liver Disorder/Hepatitis',
  'Lupus',
  'Mental, Nervous or Behavioral Disorder',
  'Migraine or Chronic Headache',
  'Multiple Sclerosis (MS)',
  'Muscle Disorders',
  'Nervous System Disorders',
  'Paralysis',
  'Partial or Total Disability',
  'Physical Disorder or Deformity',
  'Reproductive Disorders',
  'Respiratory/Lung Disorders',
  'Seizures',
  'Sexually Transmitted Disease',
  'Stroke or Transient Ischemic Attack',
  'Thyroid Disorder',
  'Transplant',
  'Urinary Disorders',
  'Vascular Disorders',
] as const;

export const WAIVER_REASONS = [
  'Individual Medical',
  'Medicare/Medicaid',
  'COBRA/Continuation',
  'Tricare',
  "Spouse's/Parent Employer Plan",
  'Cost/Do not want',
  'Other',
] as const;

export const RELATIONSHIP_OPTIONS = ['Spouse', 'Child'] as const;

export const COVERAGE_TIERS = [
  'Employee Only',
  'Employee + Spouse',
  'Employee + Child(ren)',
  'Family: Employee, Spouse, & Child(ren)',
] as const;

export const ENROLLMENT_TYPES = [
  'New Hire',
  'Re-hire',
  'Open Enrollment',
  'New Group',
  'Qualifying Life Event',
  'COBRA',
  'Waiver of Coverage',
] as const;

export const EMPLOYEE_STATUS_OPTIONS = ['W2', '1099', 'Owner/Partner'] as const;

const addressSchema = z.object({
  street: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(50).optional().default(''),
  zip: z.string().max(20).optional().default(''),
}).partial();

const sectionASchema = z.object({
  lastName: z.string().max(100),
  firstName: z.string().max(100),
  mi: z.string().max(10),
  ssn: z.string().max(20),
  gender: z.string().max(10),
  birthDate: z.string().max(20),
  avgHoursWeek: z.string().max(20),
  dateEmployedFullTime: z.string().max(20),
  homeAddress: addressSchema,
  mailingSameAsHome: z.boolean(),
  mailingAddress: addressSchema,
  homePhone: z.string().max(30),
  workPhone: z.string().max(30),
  cellPhone: z.string().max(30),
  email: z.string().max(200),
  bestTimeToCall: z.string().max(100),
  jobTitle: z.string().max(200),
  maritalStatus: z.string().max(20),
  employeeStatus: z.string().max(30),
  workScheduleType: z.string().max(30),
  cobraEffectiveDate: z.string().max(20),
  earningsBasis: z.string().max(30),
  enrollmentType: z.string().max(50),
  qualifyingEventDate: z.string().max(20),
}).partial();

const sectionBSchema = z.object({
  waiverReason: z.string().max(50),
  waiverReasonOther: z.string().max(200),
  signatureName: z.string().max(200),
  signatureDate: z.string().max(20),
}).partial();

const dependentSchema = z.object({
  lastName: z.string().max(100).optional().default(''),
  firstName: z.string().max(100).optional().default(''),
  relationship: z.string().max(30).optional().default(''),
  gender: z.string().max(10).optional().default(''),
  dob: z.string().max(20).optional().default(''),
  ssn: z.string().max(20).optional().default(''),
  tobaccoUse: z.boolean().optional().default(false),
});

const sectionDSchema = z.object({
  coverageTier: z.string().max(60),
  dependents: z.array(dependentSchema),
}).partial();

const sectionESchema = z.object({
  currentPlanActive: z.boolean(),
  currentPlanFor: z.string().max(200),
  currentPlanCarrier: z.string().max(200),
  currentPlanId: z.string().max(100),
  medicareA: z.boolean(),
  medicareB: z.boolean(),
  medicareD: z.boolean(),
  medicareFor: z.string().max(200),
  medicareRemainsActive: z.boolean(),
}).partial();

const personHealthGridSchema = z.object({
  height: z.string().max(20).optional().default(''),
  weight: z.string().max(20).optional().default(''),
  motorcycle: z.boolean().optional().default(false),
  movingViolation: z.boolean().optional().default(false),
  dui: z.boolean().optional().default(false),
});

const sectionFSchema = z.object({
  employee: personHealthGridSchema,
  spouse: personHealthGridSchema,
  conditions: z.array(z.string().max(100)),
  otherUndiagnosed: z.boolean(),
  advisedFutureTreatment: z.boolean(),
  currentlyPregnant: z.boolean(),
  dueDate: z.string().max(20),
  cSection: z.boolean(),
  multiples: z.boolean(),
  pregnancyComplications: z.boolean(),
  medicationsLast18Months: z.boolean(),
}).partial();

const sectionGRowSchema = z.object({
  person: z.string().max(200).optional().default(''),
  condition: z.string().max(200).optional().default(''),
  datesTreated: z.string().max(100).optional().default(''),
  treatment: z.string().max(500).optional().default(''),
  dateLastTaken: z.string().max(50).optional().default(''),
  prognosis: z.string().max(200).optional().default(''),
});

const sectionISchema = z.object({
  signatureName: z.string().max(200),
  signatureDate: z.string().max(20),
}).partial();

export const formDataSchema = z.object({
  sectionA: sectionASchema,
  sectionB: sectionBSchema,
  sectionD: sectionDSchema,
  sectionE: sectionESchema,
  sectionF: sectionFSchema,
  sectionG: z.array(sectionGRowSchema),
  sectionI: sectionISchema,
}).partial();

export const createEnrollmentFormSchema = z.object({
  employeeId: z.string().uuid(),
});

export const updateEnrollmentFormSchema = z.object({
  formData: formDataSchema,
});

export const submitEnrollmentFormSchema = z.object({
  formData: formDataSchema.optional(),
});

export const listEnrollmentFormsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'submitted']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type FormData = z.infer<typeof formDataSchema>;
export type CreateEnrollmentFormInput = z.infer<typeof createEnrollmentFormSchema>;
export type UpdateEnrollmentFormInput = z.infer<typeof updateEnrollmentFormSchema>;
export type SubmitEnrollmentFormInput = z.infer<typeof submitEnrollmentFormSchema>;
export type ListEnrollmentFormsQuery = z.infer<typeof listEnrollmentFormsQuerySchema>;
