import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(raw: any): EmailTemplate {
  return {
    id: raw.id,
    name: raw.name,
    subject: raw.subject ?? '',
    headerHtml: raw.header_html ?? '',
    bodyHtml: raw.body_html ?? '',
    footerHtml: raw.footer_html ?? '',
    isDefault: !!raw.is_default,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface EmailTemplateBody {
  name: string;
  subject?: string;
  headerHtml?: string;
  bodyHtml?: string;
  footerHtml?: string;
  isDefault?: boolean;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/email-templates');
      return (data.data as unknown[]).map(mapTemplate);
    },
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: EmailTemplateBody) => {
      const { data } = await apiClient.post('/email-templates', body);
      return mapTemplate(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function useUpdateEmailTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<EmailTemplateBody>) => {
      const { data } = await apiClient.put(`/email-templates/${id}`, body);
      return mapTemplate(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/email-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export interface BulkEmailResult {
  sent: number;
  total: number;
  failed: { clientId: string; company?: string; error: string }[];
}

export function useSendBulkClientEmail() {
  return useMutation({
    mutationFn: async (body: { clientIds: string[]; subject: string; headerHtml?: string; bodyHtml: string; footerHtml?: string }) => {
      const { data } = await apiClient.post('/email-templates/send', body);
      return data.data as BulkEmailResult;
    },
  });
}

// Placeholders offered in the WYSIWYG "Insert variable" dropdown (client-level).
export const EMAIL_TEMPLATE_VARIABLES = [
  { token: '{{contact_name}}', label: 'Contact name' },
  { token: '{{company_name}}', label: 'Company name' },
  { token: '{{client_name}}', label: 'Client name' },
  { token: '{{contact_email}}', label: 'Contact email' },
  { token: '{{today}}', label: "Today's date" },
];
