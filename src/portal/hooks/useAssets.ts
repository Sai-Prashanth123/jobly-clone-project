import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type AssetCategory = 'laptop' | 'desktop' | 'monitor' | 'phone' | 'tablet' | 'badge' | 'vehicle' | 'software_license' | 'other';
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';
export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired' | 'lost';

export interface Asset {
  id: string;
  displayId?: string;
  name: string;
  category: AssetCategory;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  employeeName?: string;
  employeeDisplayId?: string;
  createdAt: string;
  updatedAt: string;
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  laptop:           'Laptop',
  desktop:          'Desktop',
  monitor:          'Monitor',
  phone:            'Phone',
  tablet:           'Tablet',
  badge:            'Badge/Access Card',
  vehicle:          'Vehicle',
  software_license: 'Software License',
  other:            'Other',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  available:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned:    'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  retired:     'bg-gray-100 text-gray-500 border-gray-200',
  lost:        'bg-red-50 text-red-700 border-red-200',
};

function mapAsset(raw: any): Asset {
  const emp = raw.employee ?? {};
  return {
    id:              raw.id,
    displayId:       raw.display_id ?? undefined,
    name:            raw.name,
    category:        raw.category as AssetCategory,
    brand:           raw.brand ?? null,
    model:           raw.model ?? null,
    serialNumber:    raw.serial_number ?? null,
    condition:       raw.condition as AssetCondition,
    status:          raw.status as AssetStatus,
    purchaseDate:    raw.purchase_date ?? null,
    purchasePrice:   raw.purchase_price != null ? Number(raw.purchase_price) : null,
    warrantyExpiry:  raw.warranty_expiry ?? null,
    notes:           raw.notes ?? null,
    assignedTo:      raw.assigned_to ?? null,
    assignedAt:      raw.assigned_at ?? null,
    assignedBy:      raw.assigned_by ?? null,
    employeeName:    emp.first_name ? `${emp.first_name} ${emp.last_name}`.trim() : undefined,
    employeeDisplayId: emp.display_id ?? undefined,
    createdAt:       raw.created_at,
    updatedAt:       raw.updated_at,
  };
}

export interface AssetsFilter {
  status?: AssetStatus | 'all';
  category?: AssetCategory | 'all';
  employeeId?: string;
  page?: number;
  limit?: number;
}

export function useAssets(filter: AssetsFilter = {}) {
  return useQuery({
    queryKey: ['assets', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.status)     params.set('status',     filter.status);
      if (filter.category)   params.set('category',   filter.category);
      if (filter.employeeId) params.set('employeeId', filter.employeeId);
      if (filter.page)       params.set('page',       String(filter.page));
      if (filter.limit)      params.set('limit',      String(filter.limit));
      const { data } = await apiClient.get(`/assets?${params}`);
      return { data: (data.data as any[]).map(mapAsset), total: data.total as number };
    },
    staleTime: 30_000,
  });
}

export function useAsset(id: string | undefined) {
  return useQuery({
    queryKey: ['assets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/${id}`);
      return mapAsset(data.data);
    },
    enabled: !!id,
  });
}

export function useEmployeeAssets(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['assets', 'employee', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/assets/employee/${employeeId}`);
      return (data.data as any[]).map(mapAsset);
    },
    enabled: !!employeeId,
    staleTime: 60_000,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Asset, 'id' | 'displayId' | 'assignedTo' | 'assignedAt' | 'assignedBy' | 'employeeName' | 'employeeDisplayId' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await apiClient.post('/assets', {
        name: input.name, category: input.category, brand: input.brand, model: input.model,
        serialNumber: input.serialNumber, condition: input.condition, status: input.status,
        purchaseDate: input.purchaseDate, purchasePrice: input.purchasePrice,
        warrantyExpiry: input.warrantyExpiry, notes: input.notes,
      });
      return mapAsset(data.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Asset> & { id: string }) => {
      const { data } = await apiClient.put(`/assets/${id}`, {
        name: input.name, category: input.category, brand: input.brand, model: input.model,
        serialNumber: input.serialNumber, condition: input.condition, status: input.status,
        purchaseDate: input.purchaseDate, purchasePrice: input.purchasePrice,
        warrantyExpiry: input.warrantyExpiry, notes: input.notes,
      });
      return mapAsset(data.data);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['assets', v.id] });
    },
  });
}

export function useAssignAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { data } = await apiClient.post(`/assets/${id}/assign`, { employeeId });
      return mapAsset(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUnassignAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/assets/${id}/unassign`);
      return mapAsset(data.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/assets/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}
