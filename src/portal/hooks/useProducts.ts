import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Product } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(raw: any): Product {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    unitPrice: Number(raw.unit_price) || 0,
    unit: raw.unit ?? 'item',
    active: !!raw.active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface ProductBody {
  name: string;
  description?: string | null;
  unitPrice: number;
  unit: Product['unit'];
  active?: boolean;
}

export function useProducts(params?: { active?: boolean }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/products', { params });
      return { data: (data.data as any[]).map(mapProduct), total: data.total as number };
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProductBody) => {
      const { data } = await apiClient.post('/products', body);
      return mapProduct(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ProductBody>) => {
      const { data } = await apiClient.put(`/products/${id}`, body);
      return mapProduct(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
