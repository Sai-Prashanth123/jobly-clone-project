import { z } from 'zod';

export const createClientSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable().transform(v => v || null),
  industry: z.string().optional().default(''),
  address: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    zip: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }).optional(),
  contractStartDate: z.string().min(1),
  contractEndDate: z.string().optional().nullable().transform(v => v || null),
  netPaymentDays: z.number().int().min(0).default(30),
  defaultBillRate: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  billingType: z.enum(['hourly','monthly','milestone']).optional().nullable(),
  billingContactName: z.string().optional().nullable().transform(v => v || null),
  billingContactEmail: z.string().optional().nullable().transform(v => v || null),
  billingContactPhone: z.string().optional().nullable().transform(v => v || null),
  billingStreet: z.string().optional().nullable().transform(v => v || null),
  billingCity: z.string().optional().nullable().transform(v => v || null),
  billingState: z.string().optional().nullable().transform(v => v || null),
  billingZip: z.string().optional().nullable().transform(v => v || null),
  billingCountry: z.string().optional().nullable().transform(v => v || null),
  taxId: z.string().optional().nullable().transform(v => v || null),
  status: z.enum(['active','inactive']).default('active'),
});

export const updateClientSchema = createClientSchema.partial();

export const listClientsQuerySchema = z.object({
  status: z.enum(['active','inactive']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
