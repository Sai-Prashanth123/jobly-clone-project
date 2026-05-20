import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface MailerStatus {
  configured: boolean;
  fromAddress: string | null;
}

/**
 * Polls the backend's mailer health so the portal can render a banner when
 * GMAIL_USER / GMAIL_APP_PASSWORD aren't set in production — without that, HR
 * would silently never see welcome emails delivered.
 */
export function useMailerStatus() {
  return useQuery({
    queryKey: ['system', 'mailer-status'],
    queryFn: async (): Promise<MailerStatus> => {
      const { data } = await apiClient.get('/system/mailer-status');
      return data.data as MailerStatus;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
