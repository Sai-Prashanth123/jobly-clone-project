export type UserRole = 'admin' | 'hr' | 'operations' | 'finance' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'onboarding';
export type TimesheetStatus = 'draft' | 'submitted' | 'manager_approved' | 'client_approved' | 'rejected';
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

export interface Product {
  id: string;
  name: string;
  description?: string;
  unitPrice: number;
  unit: 'hour' | 'item' | 'day' | 'fixed';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

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

// ── Monthly attendance timesheet (separate from the weekly billing Timesheet) ──
export type MonthlyTimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type MonthlyDayStatus = 'present' | 'leave' | 'holiday' | 'absent' | 'weekend';

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
  createdByName?: string;
  createdByRole?: string;
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
  billingType?: BillingType;
  workLocation?: string;
  reportingManagerId?: string;
  createdAt: string;
  updatedAt: string;
  // Joined read-only fields from the server (employee + client names).
  employeeName?: string;
  employeeDisplayId?: string;
  clientName?: string;
  createdByName?: string;
  createdByRole?: string;
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
  clientApprovedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Zero-hour weeks require a reason; worked weeks require a client-signed proof.
  leaveReason?: string;
  clientSignedUrl?: string;
  clientSignedFilename?: string;
}

export interface InvoiceLineItem {
  itemName?: string;
  description: string;
  employeeId?: string;
  timesheetId?: string;
  productId?: string;
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
