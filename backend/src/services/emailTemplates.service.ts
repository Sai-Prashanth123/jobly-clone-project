import sanitizeHtml from 'sanitize-html';
import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ValidationError } from '../lib/errors';
import { renderTemplate, buildBrandedEmail, sendCustomEmail, mailerConfigured } from '../lib/mailer';
import type { CreateEmailTemplateInput, UpdateEmailTemplateInput, BulkClientEmailInput } from '../schemas/emailTemplate.schema';

// Allowlist for finance-authored template HTML (the WYSIWYG output). Permits
// rich formatting but strips scripts/styles/event handlers.
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div', 'table', 'thead', 'tbody',
    'tr', 'td', 'th', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^[a-z-]+$/i],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^[a-z-]+$/i],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-weight': [/^\d+$/, /^bold$/, /^normal$/],
      'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
      margin: [/^[\d.\s a-z%-]+$/i],
      padding: [/^[\d.\s a-z%-]+$/i],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};
const clean = (html: string) => sanitizeHtml(html ?? '', SANITIZE_OPTS);

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listEmailTemplates() {
  const { data, error } = await supabaseAdmin
    .from('email_templates').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getEmailTemplate(id: string) {
  const { data, error } = await supabaseAdmin.from('email_templates').select('*').eq('id', id).single();
  if (error || !data) throw new NotFoundError('Email template not found');
  return data;
}

export async function createEmailTemplate(input: CreateEmailTemplateInput, actorId?: string) {
  if (input.isDefault) await supabaseAdmin.from('email_templates').update({ is_default: false }).eq('is_default', true);
  const { data, error } = await supabaseAdmin.from('email_templates').insert({
    name: input.name,
    subject: input.subject ?? '',
    header_html: clean(input.headerHtml ?? ''),
    body_html: clean(input.bodyHtml ?? ''),
    footer_html: clean(input.footerHtml ?? ''),
    is_default: input.isDefault ?? false,
    created_by: actorId ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmailTemplate(id: string, input: UpdateEmailTemplateInput, _actorId?: string) {
  await getEmailTemplate(id);
  if (input.isDefault) await supabaseAdmin.from('email_templates').update({ is_default: false }).eq('is_default', true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.subject !== undefined) patch.subject = input.subject;
  if (input.headerHtml !== undefined) patch.header_html = clean(input.headerHtml);
  if (input.bodyHtml !== undefined) patch.body_html = clean(input.bodyHtml);
  if (input.footerHtml !== undefined) patch.footer_html = clean(input.footerHtml);
  if (input.isDefault !== undefined) patch.is_default = input.isDefault;
  const { data, error } = await supabaseAdmin.from('email_templates').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEmailTemplate(id: string, _actorId?: string) {
  await getEmailTemplate(id);
  const { error } = await supabaseAdmin.from('email_templates').delete().eq('id', id);
  if (error) throw error;
}

// ── Bulk "Email clients" send ───────────────────────────────────────────────────

// Per-client placeholder values available in the blast composer.
function clientVars(client: any): Record<string, string> {
  const contact = client.billing_contact_name || client.contact_name || 'there';
  return {
    client_name: client.company_name ?? '',
    company_name: client.company_name ?? '',
    contact_name: contact,
    contact_email: client.billing_contact_email || client.contact_email || '',
    today: new Date().toISOString().slice(0, 10),
  };
}

export async function bulkSendClientEmail(input: BulkClientEmailInput, _actorId?: string) {
  if (!mailerConfigured) {
    throw new ValidationError('Email is not configured on the server, so the blast cannot be sent.');
  }
  const { data: clients, error } = await supabaseAdmin
    .from('clients').select('*').in('id', input.clientIds);
  if (error) throw error;

  // Sanitize the authored HTML once; placeholders are rendered per recipient.
  const headerClean = clean(input.headerHtml ?? '');
  const bodyClean = clean(input.bodyHtml);
  const footerClean = clean(input.footerHtml ?? '');

  let sent = 0;
  const failed: { clientId: string; company?: string; error: string }[] = [];

  for (const client of clients ?? []) {
    const to = client.billing_contact_email || client.contact_email;
    if (!to) {
      failed.push({ clientId: client.id, company: client.company_name, error: 'No billing or contact email on file' });
      continue;
    }
    const vars = clientVars(client);
    try {
      const html = buildBrandedEmail({
        headerHtml: renderTemplate(headerClean, vars),
        bodyHtml: renderTemplate(bodyClean, vars),
        footerHtml: renderTemplate(footerClean, vars),
      });
      await sendCustomEmail({ to, subject: renderTemplate(input.subject, vars), html });
      sent++;
    } catch (err: any) {
      failed.push({ clientId: client.id, company: client.company_name, error: err?.message ?? 'send failed' });
    }
  }

  return { sent, failed, total: input.clientIds.length };
}
