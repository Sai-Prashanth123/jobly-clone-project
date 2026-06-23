import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

const STALE = 60_000; // 60s polling interval

export function useNavBadges(role: string): Record<string, number> {
  const isHrAdmin = role === 'admin' || role === 'hr';
  const canActOnTimesheets = ['admin', 'hr', 'operations', 'finance'].includes(role);
  const canActOnExpenses   = ['admin', 'hr', 'finance'].includes(role);
  const isEmployee = role === 'employee';

  // HR/admin/operations/finance — count ALL submitted timesheets pending approval
  const { data: timesheets } = useQuery<number>({
    queryKey: ['nav-badge', 'timesheets', role],
    queryFn: async () => {
      const res = await apiClient.get('/timesheets', { params: { status: 'submitted', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: canActOnTimesheets,
  });

  // Employees — count their own submitted (pending manager approval) timesheets
  const { data: myTimesheets } = useQuery<number>({
    queryKey: ['nav-badge', 'my-timesheets'],
    queryFn: async () => {
      const res = await apiClient.get('/timesheets', { params: { status: 'submitted', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: isEmployee,
  });

  // HR/admin — pending leave requests
  const { data: leaveRequests } = useQuery<number>({
    queryKey: ['nav-badge', 'leave-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/leave-requests', { params: { status: 'pending', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: isHrAdmin,
  });

  // HR/admin/finance — submitted expenses pending review
  const { data: expenses } = useQuery<number>({
    queryKey: ['nav-badge', 'expenses', role],
    queryFn: async () => {
      const res = await apiClient.get('/expenses', { params: { status: 'submitted', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: canActOnExpenses,
  });

  // Employee — their own submitted expenses
  const { data: myExpenses } = useQuery<number>({
    queryKey: ['nav-badge', 'my-expenses'],
    queryFn: async () => {
      const res = await apiClient.get('/expenses', { params: { status: 'submitted', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: isEmployee,
  });

  // HR/admin — submitted monthly timesheets (attendance review)
  const { data: attendanceReview } = useQuery<number>({
    queryKey: ['nav-badge', 'attendance-review'],
    queryFn: async () => {
      const res = await apiClient.get('/monthly-timesheets', { params: { status: 'submitted', limit: 1 } });
      return res.data.total ?? 0;
    },
    staleTime: STALE,
    refetchInterval: STALE,
    enabled: isHrAdmin,
  });

  // HR/admin — documents expiring within 30 days
  const { data: expiringDocs } = useQuery<number>({
    queryKey: ['nav-badge', 'expiring-docs'],
    queryFn: async () => {
      const res = await apiClient.get('/employees/expiring-documents', { params: { days: 30 } });
      return (res.data.data as unknown[])?.length ?? 0;
    },
    staleTime: 5 * 60_000, // 5-min cache (less volatile)
    refetchInterval: 5 * 60_000,
    enabled: isHrAdmin,
  });

  return {
    timesheets:       (canActOnTimesheets ? timesheets : myTimesheets) ?? 0,
    leaveRequests:    leaveRequests ?? 0,
    expenses:         (canActOnExpenses ? expenses : myExpenses) ?? 0,
    attendanceReview: attendanceReview ?? 0,
    expiringDocs:     expiringDocs ?? 0,
  };
}
