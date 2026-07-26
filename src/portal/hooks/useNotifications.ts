import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  entityType?: string;
  entityId?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotification(raw: any): Notification {
  return {
    id: raw.id,
    title: raw.title,
    message: raw.message,
    type: raw.type,
    entityType: raw.entity_type ?? undefined,
    entityId: raw.entity_id ?? undefined,
    link: raw.link ?? undefined,
    read: raw.read,
    createdAt: raw.created_at,
  };
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return (data.data as any[]).map(mapNotification);
    },
    refetchInterval: 120_000, // poll every 2 minutes
    // Treat data as fresh for almost the full polling window so tab re-focus
    // or route re-mount doesn't trigger an immediate extra refetch on top of
    // the interval poll.
    staleTime: 115_000,
  });
}

export interface NotificationCounts {
  total: number;
  unread: number;
  read: number;
  byType: { info: number; success: number; warning: number; error: number };
}

export function useNotificationCounts() {
  return useQuery({
    queryKey: ['notifications', 'counts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/counts');
      return data.data as NotificationCounts;
    },
    refetchInterval: 120_000,
    staleTime: 115_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useTriggerTimesheetReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/notifications/trigger/timesheet-reminders');
      return data.data as { sent: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useTriggerContractExpiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/notifications/trigger/contract-expiry');
      return data.data as { sent: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useTriggerInvoiceReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/notifications/trigger/invoice-ready');
      return data.data as { sent: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useTriggerDocumentExpiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/notifications/trigger/document-expiry');
      return data.data as { sent: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
