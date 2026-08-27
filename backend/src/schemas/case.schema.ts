import { z } from 'zod';

const CASE_TYPES = ['h1b_new', 'h1b_extension', 'h1b_transfer', 'perm_green_card', 'opt_stem_extension', 'tn_renewal', 'l1_extension', 'other'] as const;
const CASE_STATUSES = ['open', 'pending_uscis', 'rfe_received', 'case_approved', 'denied', 'closed'] as const;
const FILING_TYPES = ['cap_registration', 'pwd'] as const;
const FILING_STATUSES = ['draft', 'filed', 'certified', 'selected', 'not_selected', 'denied', 'withdrawn'] as const;

export const createCaseSchema = z.object({
  employeeId: z.string().uuid(),
  caseType: z.enum(CASE_TYPES),
  status: z.enum(CASE_STATUSES).default('open'),
  receiptNumber: z.string().optional().nullable().transform(v => v || null),
  priorityDate: z.string().optional().nullable().transform(v => v || null),
  filedDate: z.string().optional().nullable().transform(v => v || null),
  decisionDate: z.string().optional().nullable().transform(v => v || null),
  attorneyName: z.string().optional().nullable().transform(v => v || null),
  description: z.string().optional().default(''),
});

export const updateCaseSchema = createCaseSchema.partial();

export const listCasesQuerySchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  caseType: z.enum(CASE_TYPES).optional(),
  employeeId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export const createFilingSchema = z.object({
  filingType: z.enum(FILING_TYPES),
  status: z.enum(FILING_STATUSES).default('draft'),
  referenceNumber: z.string().optional().nullable().transform(v => v || null),
  filedDate: z.string().optional().nullable().transform(v => v || null),
  decisionDate: z.string().optional().nullable().transform(v => v || null),
  details: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z.string().optional().nullable().transform(v => v || null),
});

export const updateFilingSchema = createFilingSchema.partial();

export const createNoteSchema = z.object({
  body: z.string().min(1),
});

export const updateNoteSchema = createNoteSchema;

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;
export type CreateFilingInput = z.infer<typeof createFilingSchema>;
export type UpdateFilingInput = z.infer<typeof updateFilingSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
