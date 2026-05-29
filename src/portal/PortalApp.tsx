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
const Products = lazy(() => import('./pages/Products'));
const Estimates = lazy(() => import('./pages/Estimates'));
const Recurring = lazy(() => import('./pages/Recurring'));
const PublicInvoiceView = lazy(() => import('./pages/PublicInvoiceView'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Documents = lazy(() => import('./pages/Documents'));

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
              path="products"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="estimates"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <Estimates />
                </ProtectedRoute>
              }
            />
            <Route
              path="recurring"
              element={
                <ProtectedRoute allowedRoles={['admin', 'finance']}>
                  <Recurring />
                </ProtectedRoute>
              }
            />
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
                <ProtectedRoute allowedRoles={['admin', 'finance', 'operations']}>
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
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations', 'employee']}>
                  <MonthlyTimesheets />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'operations', 'employee']}>
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
