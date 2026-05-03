import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  dob: z.string().min(1, 'Date of birth is required'),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(1, 'ZIP is required'),
    country: z.string().optional().default('US'),
  }),
  department: z.string().optional().default(''),
  jobTitle: z.string().optional().default(''),
  employmentType: z.enum(['full_time','part_time','contract','w2','1099','c2c','vendor']),
  startDate: z.string(),
  status: z.enum(['active','inactive','onboarding']).default('onboarding'),
  visaType: z.enum(['h1b','l1','opt','stem_opt','tn','gc','citizen','other']),
  visaExpiry: z.string().min(1, 'Work authorization expiry is required'),
  i9Status: z.enum(['pending','complete','expired']),
  payRate: z.number().min(0),
  payType: z.enum(['hourly','salary']),
  workLocation: z.string().optional().nullable(),
  ssn: z.string().regex(/^\d{4}$/, 'SSN must be exactly 4 digits'),
  paymentType: z.enum(['w2','1099','c2c']).optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankRoutingNumber: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  taxFormType: z.enum(['w4','w9']).optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workEmail: z.string().email().optional().nullable(),
});

// Update keeps every field optional and lenient — pre-existing employees
// may have NULL values in newly-required fields, so we don't want stricter
// validation to block edits.
export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dob: z.string().optional().transform(v => v || undefined),
  address: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    zip: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }).optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentType: z.enum(['full_time','part_time','contract','w2','1099','c2c','vendor']).optional(),
  startDate: z.string().optional(),
  status: z.enum(['active','inactive','onboarding']).optional(),
  visaType: z.enum(['h1b','l1','opt','stem_opt','tn','gc','citizen','other']).optional().nullable(),
  visaExpiry: z.string().optional().nullable().transform(v => v || null),
  i9Status: z.enum(['pending','complete','expired']).optional().nullable(),
  payRate: z.number().min(0).optional(),
  payType: z.enum(['hourly','salary']).optional(),
  workLocation: z.string().optional().nullable(),
  ssn: z.string().optional().nullable(),
  paymentType: z.enum(['w2','1099','c2c']).optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankRoutingNumber: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  taxFormType: z.enum(['w4','w9']).optional().nullable(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  workEmail: z.string().email().optional().nullable(),
});

export const listEmployeesQuerySchema = z.object({
  status: z.enum(['active','inactive','onboarding']).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
