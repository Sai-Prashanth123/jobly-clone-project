import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { PortalLayout } from './components/layout/PortalLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
// Eager — small pages that are the first landing targets per area
import Login from './pages/Login';
import ForcePasswordReset from './pages/ForcePasswordReset';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import PortalClients from './pages/Clients';
import Assignments from './pages/Assignments';
import Timesheets from './pages/Timesheets';
import Invoices from './pages/Invoices';
import NotificationsPage from './pages/Notifications';
import MyProfile from './pages/MyProfile';

// Lazy — heavy or rarely-visited pages. This keeps them out of the initial
// PortalApp chunk. The biggest wins are Reports (Recharts + 16 report
// components) and all the detail pages (each pulls in the matching form).
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail'));
const TimesheetDetail = lazy(() => import('./pages/TimesheetDetail'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const Estimates = lazy(() => import('./pages/Estimates'));
const PublicInvoiceView = lazy(() => import('./pages/PublicInvoiceView'));
// Full-page finance editors (replace the old popup dialogs)
const InvoiceEditor = lazy(() => import('./pages/InvoiceEditor'));
const RecordPayment = lazy(() => import('./pages/RecordPayment'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Documents = lazy(() => import('./pages/Documents'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));

// HR drill-down pages (linked from HRDashboard cards)
const HrActiveEmployees = lazy(() => import('./pages/hr/ActiveEmployees'));
const HrOnboardingEmployees = lazy(() => import('./pages/hr/OnboardingEmployees'));
const HrInactiveEmployees = lazy(() => import('./pages/hr/InactiveEmployees'));
const HrVisaExpiringEmployees = lazy(() => import('./pages/hr/VisaExpiringEmployees'));
const HrI9StatusEmployees = lazy(() => import('./pages/hr/I9StatusEmployees'));

// New card-per-section Add Employee onboarding page
const NewEmployee = lazy(() => import('./pages/NewEmployee'));
// "Awaiting HR review" screen shown after an employee submits onboarding
const OnboardingPending = lazy(() => import('./pages/OnboardingPending'));

// Monthly attendance timesheet (separate from the weekly billing Timesheets)
const MyMonthlyTimesheet = lazy(() => import('./pages/MyMonthlyTimesheet'));
const MonthlyTimesheets = lazy(() => import('./pages/MonthlyTimesheets'));
const MonthlyTimesheetDetail = lazy(() => import('./pages/MonthlyTimesheetDetail'));

// Dedicated leave-request workflow (employee applies → HR/admin approve)
const LeaveRequests = lazy(() => import('./pages/LeaveRequests'));

// Phase 1 — Announcements + People directory
const Announcements = lazy(() => import('./pages/Announcements'));
const People = lazy(() => import('./pages/People'));

// Phase 2 — Expense Reports
const Expenses = lazy(() => import('./pages/Expenses'));

// Phase 3 — Performance Reviews
const PerformanceReviews = lazy(() => import('./pages/PerformanceReviews'));
const PerformanceReviewDetail = lazy(() => import('./pages/PerformanceReviewDetail'));
const MyPerformanceReviews = lazy(() => import('./pages/MyPerformanceReviews'));

// Phase 4 — Admin
const AuditLog = lazy(() => import('./pages/AuditLog'));
const HolidaysSettings = lazy(() => import('./pages/HolidaysSettings'));
const CompanyHolidays = lazy(() => import('./pages/CompanyHolidays'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));

// Phase 4 — HR
const Milestones = lazy(() => import('./pages/Milestones'));
const HeadcountReport = lazy(() => import('./pages/HeadcountReport'));
const ExpiringDocuments = lazy(() => import('./pages/ExpiringDocuments'));

// Phase 4 — Operations
const WorkforceAvailability = lazy(() => import('./pages/WorkforceAvailability'));
const ClientSLA = lazy(() => import('./pages/ClientSLA'));

// Phase 4 — Finance
const Budgets = lazy(() => import('./pages/Budgets'));
const TaxDocuments = lazy(() => import('./pages/TaxDocuments'));
const InvoiceAnalytics = lazy(() => import('./pages/InvoiceAnalytics'));
const ExpenseAnalytics = lazy(() => import('./pages/ExpenseAnalytics'));
const CashFlow = lazy(() => import('./pages/CashFlow'));

// Previously-built but unrouted pages — wired in now
const Assets = lazy(() => import('./pages/Assets'));
const SkillsRegistry = lazy(() => import('./pages/SkillsRegistry'));
const ShiftSchedule = lazy(() => import('./pages/ShiftSchedule'));
const ProbationTracker = lazy(() => import('./pages/ProbationTracker'));
const CapacityReport = lazy(() => import('./pages/CapacityReport'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function PortalApp() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="login" element={<Login />} />
          {/* Public shareable invoice/estimate view — no auth, token-gated. */}
          <Route path="i/:token" element={<PublicInvoiceView />} />

          {/* Authenticated but OUTSIDE the layout — the forced first-login
              password reset. Its own ProtectedRoute keeps it auth-gated; the
              shared ProtectedRoute logic pins must-reset users here and releases
              them to the dashboard once done. */}
          <Route
            path="force-password-reset"
            element={
              <ProtectedRoute>
                <ForcePasswordReset />
              </ProtectedRoute>
            }
          />

          {/* Authenticated but OUTSIDE the layout — the forced self-onboarding
              flow. NewEmployee renders in "onboarding mode" (full-screen, self-
              edit). ProtectedRoute pins incomplete employees here. */}
          <Route
            path="onboarding"
            element={
              <ProtectedRoute>
                <NewEmployee />
              </ProtectedRoute>
            }
          />

          {/* Authenticated but OUTSIDE the layout — the "awaiting HR review"
              screen shown after an employee submits onboarding. ProtectedRoute
              pins pending_review employees here until HR approves. */}
          <Route
            path="onboarding/pending"
            element={
              <ProtectedRoute>
                <OnboardingPending />
              </ProtectedRoute>
            }
          />

          {/* Protected — wrapped in layout */}
          <Route
            element={
              <ProtectedRoute>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />

            <Route
              path="employees"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations']}>
                  <Employees />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees/new"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <NewEmployee />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <NewEmployee />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations']}>
                  <EmployeeDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="clients"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <PortalClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <ClientDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="templates"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <EmailTemplates />
                </ProtectedRoute>
              }
            />
            {/* ── Full-page finance editors (replace popup dialogs) ── */}
            <Route path="invoices/new" element={<ProtectedRoute allowedRoles={['admin', 'finance']}><InvoiceEditor /></ProtectedRoute>} />
            <Route path="invoices/:id/edit" element={<ProtectedRoute allowedRoles={['admin', 'finance']}><InvoiceEditor /></ProtectedRoute>} />
            <Route path="invoices/:id/payments/new" element={<ProtectedRoute allowedRoles={['admin', 'finance']}><RecordPayment /></ProtectedRoute>} />

            <Route
              path="assignments"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operations', 'employee']}>
                  <Assignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="assignments/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operations', 'employee']}>
                  <AssignmentDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="timesheets"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations', 'finance', 'employee']}>
                  <Timesheets />
                </ProtectedRoute>
              }
            />
            <Route
              path="timesheets/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations', 'finance', 'employee']}>
                  <TimesheetDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="invoices"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <InvoiceDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance', 'hr']}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            <Route
              path="documents"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
                  <Documents />
                </ProtectedRoute>
              }
            />

            <Route path="announcements" element={<Announcements />} />
            <Route path="people" element={<People />} />

            <Route path="expenses" element={<Expenses />} />
            <Route
              path="reviews"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <PerformanceReviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="reviews/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <PerformanceReviewDetail />
                </ProtectedRoute>
              }
            />
            <Route path="my-reviews" element={<MyPerformanceReviews />} />

            <Route
              path="leave-requests"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
                  <LeaveRequests />
                </ProtectedRoute>
              }
            />

            {/* Monthly attendance timesheet (independent of weekly billing timesheets) */}
            <Route
              path="attendance"
              element={
                <ProtectedRoute allowedRoles={['employee', 'admin', 'hr']}>
                  <MyMonthlyTimesheet />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance/review"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations']}>
                  <MonthlyTimesheets />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations']}>
                  <MonthlyTimesheetDetail />
                </ProtectedRoute>
              }
            />

            {/* HR drill-down pages — segmented views of the employee list */}
            <Route
              path="hr/active"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <HrActiveEmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/onboarding"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <HrOnboardingEmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/inactive"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <HrInactiveEmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/visa-expiring"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <HrVisaExpiringEmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/i9-status"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <HrI9StatusEmployees />
                </ProtectedRoute>
              }
            />

            <Route
              path="notifications"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'finance', 'operations', 'employee']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            {/* Phase 4 — Admin */}
            <Route path="audit-log" element={<ProtectedRoute allowedRoles={['admin']}><AuditLog /></ProtectedRoute>} />
            <Route path="holidays" element={<ProtectedRoute allowedRoles={['admin','hr']}><HolidaysSettings /></ProtectedRoute>} />
            <Route path="company-holidays" element={<CompanyHolidays />} />
            <Route path="system-settings" element={<ProtectedRoute allowedRoles={['admin']}><SystemSettings /></ProtectedRoute>} />

            {/* Phase 4 — HR */}
            <Route path="milestones" element={<ProtectedRoute allowedRoles={['admin','hr']}><Milestones /></ProtectedRoute>} />
            <Route path="headcount" element={<ProtectedRoute allowedRoles={['admin','hr']}><HeadcountReport /></ProtectedRoute>} />
            <Route path="expiring-documents" element={<ProtectedRoute allowedRoles={['admin','hr']}><ExpiringDocuments /></ProtectedRoute>} />

            {/* Phase 4 — Operations */}
            <Route path="workforce" element={<ProtectedRoute allowedRoles={['admin','hr','operations']}><WorkforceAvailability /></ProtectedRoute>} />
            <Route path="client-sla" element={<ProtectedRoute allowedRoles={['admin','operations']}><ClientSLA /></ProtectedRoute>} />

            {/* Phase 4 — Finance */}
            <Route path="budgets" element={<ProtectedRoute allowedRoles={['admin','finance']}><Budgets /></ProtectedRoute>} />
            <Route path="tax-documents" element={<ProtectedRoute allowedRoles={['admin','finance','employee']}><TaxDocuments /></ProtectedRoute>} />
            <Route path="invoice-analytics" element={<ProtectedRoute allowedRoles={['admin','finance']}><InvoiceAnalytics /></ProtectedRoute>} />
            <Route path="expense-analytics" element={<ProtectedRoute allowedRoles={['admin','finance']}><ExpenseAnalytics /></ProtectedRoute>} />
            <Route path="cash-flow" element={<ProtectedRoute allowedRoles={['admin','finance']}><CashFlow /></ProtectedRoute>} />

            {/* Previously-built but unrouted pages */}
            <Route path="assets" element={<ProtectedRoute allowedRoles={['admin','hr','operations']}><Assets /></ProtectedRoute>} />
            <Route path="skills" element={<ProtectedRoute allowedRoles={['admin','hr']}><SkillsRegistry /></ProtectedRoute>} />
            <Route path="shifts" element={<ProtectedRoute allowedRoles={['admin','hr','operations']}><ShiftSchedule /></ProtectedRoute>} />
            <Route path="probation" element={<ProtectedRoute allowedRoles={['admin','hr']}><ProbationTracker /></ProtectedRoute>} />
            <Route path="capacity" element={<ProtectedRoute allowedRoles={['admin','hr','operations']}><CapacityReport /></ProtectedRoute>} />
            <Route path="estimates" element={<ProtectedRoute allowedRoles={['admin','finance']}><Estimates /></ProtectedRoute>} />
            <Route path="estimates/new" element={<ProtectedRoute allowedRoles={['admin','finance']}><InvoiceEditor /></ProtectedRoute>} />

            <Route path="profile" element={<MyProfile />} />
            {/* Self-edit: employees edit their own record via the same card form
                HR uses (NewEmployee resolves the id from the logged-in user). */}
            <Route path="profile/edit" element={<NewEmployee />} />

            {/* Default portal redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Catch-all redirect to login */}
          <Route path="*" element={<Navigate to="/portal/login" replace />} />
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </AuthProvider>
    </QueryClientProvider>
  );
}
