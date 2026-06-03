import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface InvoiceTemplate {
  id: string;
  name: string;
  accentColor: string;
  fontFamily: string;
  headerStyle: 'plain' | 'band';
  footerText: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTheme(raw: any): InvoiceTemplate {
  return {
    id: raw.id,
    name: raw.name,
    accentColor: raw.accent_color ?? '#2563EB',
    fontFamily: raw.font_family ?? 'Helvetica',
    headerStyle: (raw.header_style ?? 'plain') as 'plain' | 'band',
    footerText: raw.footer_text ?? '',
    isDefault: !!raw.is_default,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export interface InvoiceTemplateBody {
  name: string;
  accentColor?: string;
  fontFamily?: string;
  headerStyle?: 'plain' | 'band';
  footerText?: string;
  isDefault?: boolean;
}

export function useInvoiceTemplates() {
  return useQuery({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoice-templates');
      return (data.data as unknown[]).map(mapTheme);
    },
  });
}

export function useCreateInvoiceTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: InvoiceTemplateBody) => {
      const { data } = await apiClient.post('/invoice-templates', body);
      return mapTheme(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-templates'] }),
  });
}

export function useUpdateInvoiceTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<InvoiceTemplateBody>) => {
      const { data } = await apiClient.put(`/invoice-templates/${id}`, body);
      return mapTheme(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-templates'] }),
  });
}

export function useDeleteInvoiceTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/invoice-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-templates'] }),
  });
}
