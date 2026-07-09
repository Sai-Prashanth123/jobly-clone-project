import { z } from 'zod';

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['general', 'invoice']).optional().default('general'),
  subject: z.string().max(300).optional().default(''),
  headerHtml: z.string().max(20000).optional().default(''),
  bodyHtml: z.string().max(50000).optional().default(''),
  footerHtml: z.string().max(20000).optional().default(''),
  isDefault: z.boolean().optional().default(false),
});

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: z.enum(['general', 'invoice']).optional(),
  subject: z.string().max(300).optional(),
  headerHtml: z.string().max(20000).optional(),
  bodyHtml: z.string().max(50000).optional(),
  footerHtml: z.string().max(20000).optional(),
  isDefault: z.boolean().optional(),
});

export const listEmailTemplatesQuerySchema = z.object({
  type: z.enum(['general', 'invoice']).optional(),
});

// Bulk "Email clients" send: an inline (already-edited) email + the recipients.
export const bulkClientEmailSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(100),
  subject: z.string().min(1).max(300),
  headerHtml: z.string().max(20000).optional().default(''),
  bodyHtml: z.string().min(1).max(50000),
  footerHtml: z.string().max(20000).optional().default(''),
});

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
export type BulkClientEmailInput = z.infer<typeof bulkClientEmailSchema>;
export type ListEmailTemplatesQuery = z.infer<typeof listEmailTemplatesQuerySchema>;
