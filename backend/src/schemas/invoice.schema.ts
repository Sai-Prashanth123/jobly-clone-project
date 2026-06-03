import { z } from 'zod';

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

export const PAYMENT_TERMS = ['on_receipt', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60', 'custom'] as const;
export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue'] as const;

// One editable line item on the Wave-style invoice builder.
const lineItemSchema = z.object({
  itemName: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0).default(0),
  productId: z.string().uuid().optional().nullable(),
});

// Document-level discount (Wave's "Add a discount"): percentage or fixed amount,
// applied to the subtotal BEFORE tax. Shared by create + update. The resolved
// dollar amount is computed server-side; here we only validate the user's input.
const discountFields = {
  discountType: z.enum(['percentage', 'fixed']).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
};
// A percentage discount can't exceed 100; a fixed one is clamped to the subtotal
// in the service. Applied to whichever schema spreads `discountFields`.
const discountRefine = (v: { discountType?: string | null; discountValue?: number | null }) =>
  v.discountType !== 'percentage' || (v.discountValue ?? 0) <= 100;
const discountRefineOpts = { message: 'A percentage discount cannot exceed 100%.', path: ['discountValue'] };

// Generate from approved timesheets (existing flow, kept).
export const generateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  timesheetIds: z.array(z.string().uuid()).min(1),
  issueDate: ymdDate,
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
});

// Create a manual invoice / estimate from free-form line items (Wave-style).
export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  docType: z.enum(['invoice', 'estimate']).default('invoice'),
  // Optional custom number; blank → the service auto-allocates INV/EST-YYYY-####.
  invoiceNumber: z.string().trim().max(60).optional(),
  poNumber: z.string().max(100).optional().nullable(),
  paymentTerms: z.enum(PAYMENT_TERMS).default('net_30'),
  issueDate: ymdDate,
  dueDate: ymdDate.optional().nullable(),       // required only when paymentTerms = custom
  currency: z.string().max(8).default('USD'),
  lineItems: z.array(lineItemSchema).min(1),
  taxRate: z.number().min(0).max(100).default(0),
  ...discountFields,
  invoiceTemplateId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
}).refine(v => v.paymentTerms !== 'custom' || !!v.dueDate, {
  message: 'A due date is required when payment terms are "custom".',
  path: ['dueDate'],
}).refine(discountRefine, discountRefineOpts);

export const updateInvoiceSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  estimateStatus: z.enum(['draft','sent','viewed','accepted','declined','converted']).optional(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  // Editable invoice number — service applies it on drafts only (locked once issued).
  invoiceNumber: z.string().trim().max(60).optional(),
  invoiceTemplateId: z.string().uuid().optional().nullable(),
  ...discountFields,
  // Draft-only full edit (Wave-style): when lineItems is present and the invoice
  // is still a draft, the whole document is rebuilt from these fields. Ignored
  // for issued invoices (the service rejects line-item edits there).
  clientId: z.string().uuid().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  issueDate: ymdDate.optional(),
  dueDate: ymdDate.optional().nullable(),
  currency: z.string().max(8).optional(),
  lineItems: z.array(lineItemSchema).optional(),
}).refine(discountRefine, discountRefineOpts);

export const listInvoicesQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  docType: z.enum(['invoice', 'estimate']).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

// Days a given payment-terms value adds to the issue date.
export function paymentTermsDays(terms: string): number {
  switch (terms) {
    case 'on_receipt': return 0;
    case 'net_7': return 7;
    case 'net_14': return 14;
    case 'net_30': return 30;
    case 'net_45': return 45;
    case 'net_60': return 60;
    default: return 30;
  }
}

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
