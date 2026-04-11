import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { PortalLayout } from './components/layout/PortalLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
// Eager — small pages that are the first landing targets per area
import Login from './pages/Login';
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
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

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
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="login" element={<Login />} />

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
                <ProtectedRoute allowedRoles={['admin', 'operations', 'finance']}>
                  <PortalClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operations', 'finance']}>
                  <ClientDetail />
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

            {/* Default portal redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Catch-all redirect to login */}
          <Route path="*" element={<Navigate to="/portal/login" replace />} />
        </Routes>
        </Suspense>
    </AuthProvider>
    </QueryClientProvider>
  );
}
