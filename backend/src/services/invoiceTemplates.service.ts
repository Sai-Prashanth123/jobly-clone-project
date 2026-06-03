import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';
import type { InvoiceTheme } from '../lib/pdfGenerator';
import type { CreateInvoiceTemplateInput, UpdateInvoiceTemplateInput } from '../schemas/invoiceTemplate.schema';

export async function listInvoiceTemplates() {
  const { data, error } = await supabaseAdmin
    .from('invoice_templates').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getInvoiceTemplate(id: string) {
  const { data, error } = await supabaseAdmin.from('invoice_templates').select('*').eq('id', id).single();
  if (error || !data) throw new NotFoundError('Invoice template not found');
  return data;
}

export async function createInvoiceTemplate(input: CreateInvoiceTemplateInput, actorId?: string) {
  if (input.isDefault) await supabaseAdmin.from('invoice_templates').update({ is_default: false }).eq('is_default', true);
  const { data, error } = await supabaseAdmin.from('invoice_templates').insert({
    name: input.name,
    accent_color: input.accentColor,
    font_family: input.fontFamily,
    header_style: input.headerStyle,
    footer_text: input.footerText,
    is_default: input.isDefault ?? false,
    created_by: actorId ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateInvoiceTemplate(id: string, input: UpdateInvoiceTemplateInput) {
  await getInvoiceTemplate(id);
  if (input.isDefault) await supabaseAdmin.from('invoice_templates').update({ is_default: false }).eq('is_default', true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.accentColor !== undefined) patch.accent_color = input.accentColor;
  if (input.fontFamily !== undefined) patch.font_family = input.fontFamily;
  if (input.headerStyle !== undefined) patch.header_style = input.headerStyle;
  if (input.footerText !== undefined) patch.footer_text = input.footerText;
  if (input.isDefault !== undefined) patch.is_default = input.isDefault;
  const { data, error } = await supabaseAdmin.from('invoice_templates').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInvoiceTemplate(id: string) {
  await getInvoiceTemplate(id);
  const { error } = await supabaseAdmin.from('invoice_templates').delete().eq('id', id);
  if (error) throw error;
}

// Resolve the theme for an invoice: its assigned template → else the default
// template → else the built-in Classic look. Used by the PDF renderer.
export async function getInvoiceTheme(templateId: string | null | undefined): Promise<InvoiceTheme> {
  let row: any = null;
  if (templateId) {
    const { data } = await supabaseAdmin.from('invoice_templates').select('*').eq('id', templateId).maybeSingle();
    row = data;
  }
  if (!row) {
    const { data } = await supabaseAdmin.from('invoice_templates').select('*').eq('is_default', true).maybeSingle();
    row = data;
  }
  if (!row) return { accentColor: '#2563EB', headerStyle: 'plain' };
  return { accentColor: row.accent_color, headerStyle: row.header_style, footerText: row.footer_text };
}
