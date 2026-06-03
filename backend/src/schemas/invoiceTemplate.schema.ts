import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a #RRGGBB hex color');

export const createInvoiceTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  accentColor: hexColor.optional().default('#2563EB'),
  fontFamily: z.enum(['Helvetica', 'Times-Roman', 'Courier']).optional().default('Helvetica'),
  headerStyle: z.enum(['plain', 'band']).optional().default('plain'),
  footerText: z.string().max(300).optional().default('Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com'),
  isDefault: z.boolean().optional().default(false),
});

export const updateInvoiceTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  accentColor: hexColor.optional(),
  fontFamily: z.enum(['Helvetica', 'Times-Roman', 'Courier']).optional(),
  headerStyle: z.enum(['plain', 'band']).optional(),
  footerText: z.string().max(300).optional(),
  isDefault: z.boolean().optional(),
});

export type CreateInvoiceTemplateInput = z.infer<typeof createInvoiceTemplateSchema>;
export type UpdateInvoiceTemplateInput = z.infer<typeof updateInvoiceTemplateSchema>;
