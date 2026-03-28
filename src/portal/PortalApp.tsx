import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { PortalLayout } from './components/layout/PortalLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import PortalClients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Assignments from './pages/Assignments';
import AssignmentDetail from './pages/AssignmentDetail';
import Timesheets from './pages/Timesheets';
import TimesheetDetail from './pages/TimesheetDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';
import NotificationsPage from './pages/Notifications';
import AdminSettings from './pages/AdminSettings';
import MyProfile from './pages/MyProfile';

export default function PortalApp() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
    </AuthProvider>
    </QueryClientProvider>
  );
}
