export type UserRole = 'admin' | 'hr' | 'operations' | 'finance' | 'employee' | 'legal';
export type EmployeeStatus = 'active' | 'inactive' | 'onboarding';
export type TimesheetStatus = 'draft' | 'submitted' | 'manager_approved' | 'rejected';
export type LeaveType = 'medical_leave' | 'sick' | 'vacation' | 'unpaid_leave' | 'bereavement' | 'jury_duty' | 'other';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string; // UUID
  displayId?: string; // LV-XXXX
  employeeId: string;
  employeeName?: string;
  employeeDisplayId?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysRequested: number;
  reason?: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue';
export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'converted';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidOn: string;
  method: 'bank_transfer' | 'cheque' | 'cash' | 'card' | 'other';
  reference?: string;
  notes?: string;
  createdAt: string;
}
export type AssignmentStatus = 'active' | 'completed' | 'pending' | 'terminated';
export type PayType = 'hourly' | 'salary';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'w2' | '1099' | 'c2c' | 'vendor';
export type BillingType = 'hourly' | 'monthly' | 'milestone';
export type VisaType = 'h1b' | 'l1' | 'opt' | 'stem_opt' | 'tn' | 'gc' | 'citizen' | 'other';
export type I9Status = 'pending' | 'complete' | 'expired';
export type EVerifyStatus = 'not_started' | 'pending' | 'employment_authorized' | 'tentative_nonconfirmation' | 'case_closed';

// ── Monthly attendance timesheet (separate from the weekly billing Timesheet) ──
export type MonthlyTimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type MonthlyDayStatus = 'present' | 'leave' | 'holiday' | 'absent' | 'weekend' | 'none';

export interface MonthlyTimesheetEntry {
  date: string;        // YYYY-MM-DD
  dayOfWeek: string;   // 'Mon', 'Tue', …
  project: string;
  task: string;
  startTime: string;   // 'HH:MM'
  endTime: string;
  hours: number;
  status: MonthlyDayStatus;
}

export interface MonthlyTimesheet {
  id: string;
  displayId?: string;
  employeeId: string;
  year: number;
  month: number;       // 1-12
  entries: MonthlyTimesheetEntry[];
  totalHours: number;
  expectedHours: number;
  workingDays: number;
  leaveDays: number;
  status: MonthlyTimesheetStatus;
  notes?: string;
  rejectionReason?: string;
  pdfUrl?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined from the employees table on list/detail responses (read-only).
  employeeName?: string;
  employeeDisplayId?: string;
  department?: string;
  // Zero-hour periods require a reason (medical leave / sick / unpaid / etc.).
  leaveReason?: string;
  // Client-signed proof attachment (required at submit-time when total_hours > 0).
  clientSignedUrl?: string;
  clientSignedFilename?: string;
  // HR-only internal notes on this timesheet.
  hrNotes?: string;
  // Employee contact email (joined from employees table, admin/hr view only).
  employeeEmail?: string;
}

// Active employee with no monthly_timesheets row for a given period (HR "who hasn't filed yet" view).
export interface NotSubmittedEmployee {
  id: string;
  displayId?: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  avatarInitials: string;
  // True while the user is still on a one-time temporary password and must set
  // their own before getting any other access (enforced by the backend gate +
  // the ProtectedRoute force-reset redirect).
  mustResetPassword?: boolean;
  // False while an employee still has to finish self-onboarding (gates the
  // dashboard via ProtectedRoute). Always true/undefined for non-employee roles.
  onboardingComplete?: boolean;
  // 4-state onboarding gate (employees only): 'in_progress' (filling the form),
  // 'pending_review' (submitted, awaiting HR approval), 'changes_requested'
  // (HR sent the employee back to fix something), 'approved' (HR set the
  // employee active). Non-employees are always 'approved'. Drives ProtectedRoute.
  onboardingStatus?: 'in_progress' | 'pending_review' | 'changes_requested' | 'approved';
  // When status is 'changes_requested', the latest message HR sent + when it
  // was sent. Surfaced on the OnboardingPending screen.
  onboardingChangeRequestMessage?: string | null;
  onboardingChangeRequestedAt?: string | null;
}

// Added for real backend: UUID is the primary id, displayId is human-readable (EMP-0001)

export interface AuthSession {
  user: PortalUser;
  loginTime: string;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url?: string;
  expiryDate?: string;
  legalFlagged?: boolean;
  legalFlagComment?: string | null;
  uploadedByName?: string;
  uploadedByRole?: string;
}

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface OnboardingStatus {
  percent: number;       // 0..100
  complete: boolean;
  missing: string[];     // labels of incomplete required items
  items: OnboardingChecklistItem[];
}

// Onboarding-form education + work-history rows. Stored as JSONB on the
// employees table (migration 005). Keep optional/free-form so partial rows
// don't block validation on the rest of the form.
export interface EducationEntry {
  level?: string;          // 'high_school' | 'associate' | 'bachelor' | 'master' | 'mba' | 'phd' | 'bootcamp' | 'certification' | 'other'
  specialization?: string;
  institution?: string;
  passYear?: string;
  gradeOrGPA?: string;
  mode?: string;           // 'on_campus' | 'online' | 'hybrid'
}

export interface WorkHistoryEntry {
  company?: string;
  jobTitle?: string;
  fromDate?: string;
  toDate?: string;
  reasonForLeaving?: string;
  lastAnnualSalary?: number | null;
}

export interface PermanentAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// US-issued identity documents (driver's license, passport, EAD, etc.).
// Stored as a JSONB array on the employee row. File scans live in the
// existing `documents` table, tagged by docType matching `type` below.
export interface IdentityDocumentEntry {
  type: string;        // 'ssn' | 'driver_license' | 'state_id' | 'passport' | 'ead' | 'green_card' | 'other'
  number?: string;
  state?: string;      // issuing state for DL / state ID
  expiry?: string;     // expiry for passport / EAD / green card
}

// H-4 dependents (H1B holder's spouse/children). Stored as a JSONB array on
// the employee row, same as IdentityDocumentEntry above — but unlike that
// array, each entry has its own stable client-generated `id` since the
// dedicated passport-upload endpoint addresses one entry directly, and its
// own file (a private storage path, minted into a signed URL on demand) since
// there's no shared `documents` row to tag it against.
export interface Dependent {
  id: string;
  relationship: 'spouse' | 'child';
  firstName?: string;
  lastName?: string;
  passportExpiry?: string;
  passportStoragePath?: string | null;
  passportFileName?: string | null;
}

export interface ClientDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url?: string;
}

export interface Employee {
  id: string; // UUID (primary key for API calls)
  displayId?: string; // EMP-XXXX (human-readable)
  // Write-only: set on useCreateEmployee's payload for the New Case "quick add
  // candidate" flow to skip issuing portal credentials/welcome email/onboarding
  // checklist for a placeholder record created before the person is hired.
  // Never populated by mapEmployee — read-side responses don't carry it back.
  isCandidate?: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  department: string;
  jobTitle: string;
  employmentType: EmploymentType;
  startDate: string;
  status: EmployeeStatus;
  // Extended-leave window (status stays 'inactive'; auto-returns on the date).
  leaveStartedAt?: string;
  leaveReturnDate?: string;
  leaveReason?: string;
  // Termination (login disabled, record kept; status 'inactive').
  terminatedAt?: string;
  terminationReason?: string;
  visaType?: VisaType;
  visaExpiry?: string;
  i9Status?: I9Status;
  eVerifyStatus?: EVerifyStatus;
  eVerifyCaseNumber?: string;
  payRate: number;
  payType: PayType;
  workLocation?: string;
  ssn?: string;
  paymentType?: 'w2' | '1099' | 'c2c';
  bankName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  taxFormType?: 'w4' | 'w9';
  reportingManagerId?: string;
  workEmail?: string;
  blockPersonalEmail?: boolean;
  documents: EmployeeDocument[];

  // Onboarding completeness (computed server-side). Present on list + detail.
  onboarding?: OnboardingStatus;
  // Timestamp the employee finished self-onboarding (migration 009). Null until done.
  onboardingCompletedAt?: string;
  // HR-to-employee change request on the submitted onboarding (migration 010).
  // When non-null, EmployeeDetail shows a "Last change request" history line
  // and the employee's gate flips to `changes_requested`.
  onboardingChangeRequestMessage?: string | null;
  onboardingChangeRequestedAt?: string | null;
  onboardingChangeRequestedBy?: string | null;

  // Onboarding-form extension fields (migration 005). All optional.
  middleName?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  preferredLanguage?: string;
  languagesKnown?: string;
  profilePhotoUrl?: string;
  altPhone?: string;
  linkedinUrl?: string;
  skypeId?: string;
  permanentAddress?: PermanentAddress;
  emergencyContact?: EmergencyContact;
  education?: EducationEntry[];
  workHistory?: WorkHistoryEntry[];
  totalExperienceYears?: number;
  experienceLevel?: string;
  bloodGroup?: string;
  identityDocuments?: IdentityDocumentEntry[];
  dependents?: Dependent[];

  createdByName?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string; // UUID
  displayId?: string; // CLT-XXXX
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  industry: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  contractStartDate: string;
  contractEndDate?: string;
  netPaymentDays: number;
  defaultBillRate: number;
  currency: string;
  billingType?: BillingType;
  billingContactName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  taxId?: string;
  documents: ClientDocument[];
  status: 'active' | 'inactive';
  onboardingStatus?: 'not_started' | 'in_progress' | 'completed';
  internalNotes?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export type CaseType = 'h1b_new' | 'h1b_extension' | 'h1b_transfer' | 'perm_green_card' | 'opt_stem_extension' | 'tn_renewal' | 'l1_extension' | 'other';
export type CaseStatus = 'open' | 'pending_uscis' | 'rfe_received' | 'case_approved' | 'denied' | 'closed';
export type FilingType = 'cap_registration' | 'pwd';
export type FilingStatus = 'draft' | 'filed' | 'certified' | 'selected' | 'not_selected' | 'denied' | 'withdrawn';
export type TicketStatus = 'new' | 'in_progress' | 'resolved';

export interface CaseFiling {
  id: string;
  displayId?: string; // FIL-XXXX
  filingType: FilingType;
  status: FilingStatus;
  referenceNumber?: string;
  filedDate?: string;
  decisionDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseStatusStep {
  key: string;
  label: string;
  order: number;
  completedAt?: string;
}

export interface CaseNote {
  id: string;
  body: string;
  authorId?: string;
  authorName?: string;
  editedAt?: string;
  createdAt: string;
  title?: string;
  taggedTo?: string;
  taggedToName?: string;
  status?: string;
  accessLevel?: string;
}

export interface CaseMessage {
  id: string;
  body: string;
  authorId?: string;
  authorName?: string;
  audience: 'all' | 'law_firm' | 'beneficiary';
  createdAt: string;
  read: boolean;
}

// A Case is Legal's tracked immigration matter for one Employee — the
// umbrella record CAP Registration/PWD filings and Notes attach to.
export interface LegalCase {
  id: string; // UUID
  displayId?: string; // CASE-XXXX
  employeeId: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeeDisplayId?: string;
  employeeVisaType?: VisaType;
  employeeVisaExpiry?: string;
  caseType: CaseType;
  status: CaseStatus;
  receiptNumber?: string;
  priorityDate?: string;
  filedDate?: string;
  decisionDate?: string;
  attorneyName?: string;
  description: string;
  petitionerId?: string;
  petitionerName?: string;
  classification?: string;
  // Full Beneficiary Info (Personal/Employment/Additional Information tabs) —
  // whatever fields cases.service.ts's EMPLOYEE_EMBED currently returns,
  // kept in sync with the backend's LEGAL_ALLOWED_EMPLOYEE_FIELDS allowlist.
  beneficiary?: Partial<Employee>;
  // The employee's own already-uploaded documents (onboarding/identity docs)
  // — a separate, read-only-here set from this case's own categorized
  // documents (CaseDocument, entity_type='case').
  employeeDocuments: EmployeeDocument[];
  statusSteps: CaseStatusStep[];
  filings: CaseFiling[];
  notes: CaseNote[];
  createdAt: string;
  updatedAt: string;
}

export const CASE_DOCUMENT_CATEGORIES = [
  'Clear Copy of New and Old Passport along with Visa Stamps',
  'Degree along with transcripts of all semesters',
  'Copy of W-2 Forms issued for all tax years till present',
  'Copy of all prior Notice of Approvals/Receipts',
  'Copy of Educational Evaluation, if any',
  'Letters of Experience',
  'PERM Documents',
  'Forms and Letters',
  'Scanned/Signed Documents',
  'Other Documents, if any',
] as const;
export type CaseDocumentCategory = typeof CASE_DOCUMENT_CATEGORIES[number];

export interface CaseDocument {
  id: string;
  name: string;
  category: CaseDocumentCategory | string;
  uploadedByName?: string;
  uploadedByRole?: string;
  uploadedAt: string;
}

export interface Petitioner {
  id: string;
  name: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  einFein?: string;
  createdAt: string;
  updatedAt: string;
}

// A request HR/Admin raises to Legal about a specific Case or Employee — a
// single-resolution queue, not a back-and-forth message thread.
export interface SupportTicket {
  id: string; // UUID
  displayId?: string; // TCKT-XXXX
  caseId?: string;
  caseDisplayId?: string;
  employeeId?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeeDisplayId?: string;
  subject: string;
  message: string;
  status: TicketStatus;
  resolution?: string;
  createdById: string;
  createdByName?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string; // UUID
  displayId?: string; // ASN-XXXX
  employeeId: string;
  clientId: string;
  projectName: string;
  role: string;
  startDate: string;
  endDate?: string;
  billRate: number;
  payRate: number;
  maxHoursPerWeek: number;
  status: AssignmentStatus;
  // The true stored status, before the read-time "completed" overlay (which
  // auto-displays status as Completed once endDate has passed). Edit forms
  // should seed from this, not `status`, so an unrelated save doesn't
  // silently persist the decorated value as a real status change.
  rawStatus?: AssignmentStatus;
  billingType?: BillingType;
  workLocation?: string;
  reportingManagerId?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  // Joined read-only fields from the server (employee + client names).
  employeeName?: string;
  employeeDisplayId?: string;
  employeeEmail?: string;
  clientName?: string;
  reportingManagerName?: string;
  createdByName?: string;
  createdByRole?: string;
  updatedByName?: string;
  updatedByRole?: string;
}

export interface TimesheetEntry {
  date: string;
  dayOfWeek: string;
  hours: number;
  isBillable: boolean;
}

export interface Timesheet {
  id: string; // UUID
  displayId?: string; // TS-XXXX
  employeeId: string;
  assignmentId: string;
  clientId: string;
  weekStartDate: string; // Monday
  weekEndDate: string;   // Sunday
  entries: TimesheetEntry[];
  totalHours: number;
  status: TimesheetStatus;
  submittedAt?: string;
  managerApprovedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Zero-hour weeks require a reason; worked weeks require a client-signed proof.
  leaveReason?: string;
  clientSignedUrl?: string;
  clientSignedFilename?: string;
  hrNotes?: string;
  employeeEmail?: string;
}

export interface InvoiceLineItem {
  itemName?: string;
  description: string;
  employeeId?: string;
  timesheetId?: string;
  quantity?: number;
  hours: number;
  billRate: number;
  unitPrice?: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // INV-2026-XXXX / EST-2026-XXXX
  clientId: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  // Document-level discount (Wave's "Add a discount"), applied to subtotal before tax.
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  status: InvoiceStatus;
  docType?: 'invoice' | 'estimate';
  estimateStatus?: EstimateStatus;
  poNumber?: string;
  paymentTerms?: string;
  invoiceTemplateId?: string;
  emailTemplateId?: string;
  currency?: string;
  terms?: string;
  publicToken?: string;
  viewedAt?: string;
  convertedInvoiceId?: string;
  timesheetIds: string[];
  attachments?: InvoiceAttachment[];
  pdfUrl?: string;
  paidAt?: string;
  notes?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAttachment {
  id: string;
  name: string;
  type: string;       // mime type or doc-type label
  uploadedAt: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
}

// ── Announcements ──────────────────────────────────────────────────────────────
export type AnnouncementType = 'info' | 'urgent' | 'event' | 'policy';

export interface Announcement {
  id: string;
  displayId?: string;
  title: string;
  body: string;
  type: AnnouncementType;
  isPinned: boolean;
  targetRoles: UserRole[];
  authorId?: string;
  author?: { id: string; name: string; email: string };
  expiresAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Employee Directory ─────────────────────────────────────────────────────────
export interface DirectoryEmployee {
  id: string;
  displayId?: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  workEmail?: string;
  phone?: string;
  avatarUrl?: string;
  workLocation?: string;
}

// ── Leave Balance ──────────────────────────────────────────────────────────────
export type LeaveAccrualType = 'fixed' | 'accrual';

export interface LeaveTypeConfig {
  id: string;
  displayId?: string;
  name: string;
  code: string;
  description?: string | null;
  accrualType: LeaveAccrualType;
  defaultDays: number;
  accrualRate?: number | null;
  maxCarryover: number;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  leaveType: LeaveTypeConfig;
  year: number;
  granted: number;
  carriedOver: number;
  used: number;
  remaining: number;
}
