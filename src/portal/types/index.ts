export type UserRole = 'admin' | 'hr' | 'operations' | 'finance' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'onboarding';
export type TimesheetStatus = 'draft' | 'submitted' | 'manager_approved' | 'client_approved' | 'rejected';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type AssignmentStatus = 'active' | 'completed' | 'pending' | 'terminated';
export type PayType = 'hourly' | 'salary';
export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'w2' | '1099' | 'c2c' | 'vendor';
export type BillingType = 'hourly' | 'monthly' | 'milestone';
export type VisaType = 'h1b' | 'l1' | 'opt' | 'stem_opt' | 'tn' | 'gc' | 'citizen' | 'other';
export type I9Status = 'pending' | 'complete' | 'expired';

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  avatarInitials: string;
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
  managerId?: string;
  status: EmployeeStatus;
  visaType?: VisaType;
  visaExpiry?: string;
  i9Status?: I9Status;
  payRate: number;
  payType: PayType;
  payFrequency: PayFrequency;
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
}

export interface InvoiceLineItem {
  description: string;
  employeeId: string;
  timesheetId: string;
  hours: number;
  billRate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // INV-2026-XXXX
  clientId: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  timesheetIds: string[];
  pdfUrl?: string;
  paidAt?: string;
  notes?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
}
