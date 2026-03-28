import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  entityType?: string;
  entityId?: string;
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
    refetchInterval: 60_000, // poll every 60s
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count');
      return data.data.count as number;
    },
    refetchInterval: 60_000,
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
