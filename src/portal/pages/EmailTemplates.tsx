import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Send, Mail, Loader2, Search, AlertCircle } from 'lucide-react';
import { RichTextEditor } from '../components/shared/RichTextEditor';
import {
  useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate,
  useSendBulkClientEmail, EMAIL_TEMPLATE_VARIABLES, EMAIL_TEMPLATE_INVOICE_VARIABLES,
  type EmailTemplate, type EmailTemplateType,
} from '../hooks/useEmailTemplates';
import {
  useInvoiceTemplates, useCreateInvoiceTemplate, useUpdateInvoiceTemplate, useDeleteInvoiceTemplate,
  type InvoiceTemplate,
} from '../hooks/useInvoiceTemplates';
import { useClients } from '../hooks/useClients';

// Mirror of the backend renderTemplate — used for the live preview only.
function fillVars(html: string, vars: Record<string, string>): string {
  return (html || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k: string) => vars[k.toLowerCase()] ?? '');
}
const SAMPLE_VARS: Record<string, string> = {
  contact_name: 'Sai Prashanth', company_name: 'Acme Manufacturing Inc.', client_name: 'Acme Manufacturing Inc.',
  contact_email: 'billing@acme.example', today: new Date().toISOString().slice(0, 10),
};

function PreviewPane({ subject, header, body, footer }: { subject: string; header: string; body: string; footer: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <p className="text-xs text-muted-foreground mb-2">Preview (sample data)</p>
      <div className="rounded-md overflow-hidden border bg-white">
        <div className="px-5 py-3 text-white" style={{ background: 'linear-gradient(135deg,#2563EB,#0F2942)' }}>
          <div className="text-base font-bold">Jobly Solutions</div>
          <div className="text-xs opacity-85">Workforce Management</div>
        </div>
        <div className="px-5 py-4 text-sm text-gray-700">
          <p className="text-xs text-muted-foreground mb-2">Subject: <span className="font-medium text-gray-700">{fillVars(subject, SAMPLE_VARS) || '—'}</span></p>
          {header && <div className="mb-3 text-[#0F2942] tiptap-content" dangerouslySetInnerHTML={{ __html: fillVars(header, SAMPLE_VARS) }} />}
          <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: fillVars(body, SAMPLE_VARS) }} />
          {footer && <div className="mt-4 pt-3 border-t text-gray-500 text-[13px] tiptap-content" dangerouslySetInnerHTML={{ __html: fillVars(footer, SAMPLE_VARS) }} />}
        </div>
      </div>
    </div>
  );
}

// ── Templates manager tab ───────────────────────────────────────────────────────
function TemplatesTab() {
  const { data: templates, isLoading, isError, refetch } = useEmailTemplates();
  const createTpl = useCreateEmailTemplate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = templates?.find(t => t.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Templates</CardTitle>
          <Button size="sm" variant="outline" className="gap-1.5" loading={createTpl.isPending}
            onClick={async () => {
              try {
                const t = await createTpl.mutateAsync({ name: 'Untitled template', subject: '', bodyHtml: '<p>Hi {{contact_name}},</p><p></p>' });
                setSelectedId(t.id);
              } catch { toast.error('Could not create template'); }
            }}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isError && (
            <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-xs text-red-500">Failed to load templates.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
            </div>
          )}
          {!isError && (templates ?? []).map(t => (
            <button key={t.id} type="button" onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
              <span className="font-medium">{t.name}</span>
              <span className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${t.type === 'invoice' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.type === 'invoice' ? 'Invoice' : 'General'}
              </span>
              {t.isDefault && <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-600">Default</span>}
            </button>
          ))}
          {!isLoading && !isError && (templates ?? []).length === 0 && <p className="text-sm text-muted-foreground px-3 py-2">No templates yet.</p>}
        </CardContent>
      </Card>

      {selected ? <TemplateEditor key={selected.id} template={selected} onDeleted={() => setSelectedId(null)} />
        : <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Select a template to edit, or create a new one.</CardContent></Card>}
    </div>
  );
}

function TemplateEditor({ template, onDeleted }: { template: EmailTemplate; onDeleted: () => void }) {
  const updateTpl = useUpdateEmailTemplate(template.id);
  const deleteTpl = useDeleteEmailTemplate();
  const [name, setName] = useState(template.name);
  const [type, setType] = useState<EmailTemplateType>(template.type);
  const [subject, setSubject] = useState(template.subject);
  const [header, setHeader] = useState(template.headerHtml);
  const [body, setBody] = useState(template.bodyHtml);
  const [footer, setFooter] = useState(template.footerHtml);
  const [isDefault, setIsDefault] = useState(template.isDefault);
  const variables = type === 'invoice' ? [...EMAIL_TEMPLATE_VARIABLES, ...EMAIL_TEMPLATE_INVOICE_VARIABLES] : EMAIL_TEMPLATE_VARIABLES;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Edit template</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            loading={deleteTpl.isPending}
            onClick={async () => { try { await deleteTpl.mutateAsync(template.id); toast.success('Template deleted'); onDeleted(); } catch { toast.error('Delete failed'); } }}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button size="sm" className="gap-1.5" loading={updateTpl.isPending} loadingText="Saving…"
            onClick={async () => {
              if (!name.trim()) { toast.error('Name is required'); return; }
              try { await updateTpl.mutateAsync({ name, type, subject, headerHtml: header, bodyHtml: body, footerHtml: footer, isDefault }); toast.success('Template saved'); }
              catch { toast.error('Save failed'); }
            }}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Template name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Used for</Label>
            <Select value={type} onValueChange={v => setType(v as EmailTemplateType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General (Email clients blast)</SelectItem>
                <SelectItem value="invoice">Invoice emails</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Payment reminder for {{company_name}}" /></div>
        </div>
        {type === 'invoice' && (
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
            This template can be selected on the invoice form's "Email template" picker. The line items, total, and due date are always included automatically below your content — no need to add them yourself.
          </p>
        )}
        <div className="space-y-1.5"><Label>Header</Label><RichTextEditor value={header} onChange={setHeader} variables={variables} minHeight={80} placeholder="Optional header / greeting…" /></div>
        <div className="space-y-1.5"><Label>Body</Label><RichTextEditor value={body} onChange={setBody} variables={variables} minHeight={200} placeholder="Main message…" /></div>
        <div className="space-y-1.5"><Label>Footer</Label><RichTextEditor value={footer} onChange={setFooter} variables={variables} minHeight={80} placeholder="Sign-off / signature…" /></div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isDefault} onCheckedChange={v => setIsDefault(!!v)} /> Use as the default template for this type
        </label>
        <PreviewPane subject={subject} header={header} body={body} footer={footer} />
      </CardContent>
    </Card>
  );
}

// ── Compose / send blast tab ─────────────────────────────────────────────────────
function ComposeTab() {
  // Only "general" templates make sense as a starting point for the bulk
  // client blast — "invoice" templates are scoped to the invoice-send flow.
  const { data: templates } = useEmailTemplates({ type: 'general' });
  const { data: clientData } = useClients({ limit: 500 });
  const sendBulk = useSendBulkClientEmail();

  const [subject, setSubject] = useState('');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('<p>Hi {{contact_name}},</p><p></p>');
  const [footer, setFooter] = useState('');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const clients = clientData?.data ?? [];
  const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? activeClients.filter(c => c.companyName.toLowerCase().includes(q)) : activeClients;
  }, [activeClients, search]);
  const emailOf = (c: typeof clients[number]) => c.billingContactEmail || c.contactEmail || '';

  const loadTemplate = (id: string) => {
    const t = templates?.find(x => x.id === id);
    if (!t) return;
    setSubject(t.subject); setHeader(t.headerHtml); setBody(t.bodyHtml); setFooter(t.footerHtml);
  };

  const toggle = (id: string) => setSelectedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedClients.has(c.id));
  const toggleAll = () => setSelectedClients(prev => {
    const n = new Set(prev);
    if (allFilteredSelected) filtered.forEach(c => n.delete(c.id));
    else filtered.forEach(c => emailOf(c) && n.add(c.id));
    return n;
  });

  const send = async () => {
    const ids = [...selectedClients];
    if (ids.length === 0) { toast.error('Select at least one client'); return; }
    if (!subject.trim()) { toast.error('Enter a subject'); return; }
    if (!body.trim() || body === '<p></p>') { toast.error('Enter a message body'); return; }
    try {
      const r = await sendBulk.mutateAsync({ clientIds: ids, subject, headerHtml: header, bodyHtml: body, footerHtml: footer });
      if (r.failed.length === 0) toast.success(`Email sent to all ${r.sent} client${r.sent !== 1 ? 's' : ''}.`);
      else toast.warning(`Sent to ${r.sent}/${r.total}. ${r.failed.length} failed: ${r.failed.map(f => f.company || f.clientId).slice(0, 5).join(', ')}`, { duration: 15000 });
    } catch { toast.error('Bulk send failed.'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Compose</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start from a template</Label>
                <Select value="" onValueChange={loadTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                  <SelectContent>{(templates ?? []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" /></div>
            </div>
            <div className="space-y-1.5"><Label>Header</Label><RichTextEditor value={header} onChange={setHeader} variables={EMAIL_TEMPLATE_VARIABLES} minHeight={70} placeholder="Optional header…" /></div>
            <div className="space-y-1.5"><Label>Body</Label><RichTextEditor value={body} onChange={setBody} variables={EMAIL_TEMPLATE_VARIABLES} minHeight={200} /></div>
            <div className="space-y-1.5"><Label>Footer</Label><RichTextEditor value={footer} onChange={setFooter} variables={EMAIL_TEMPLATE_VARIABLES} minHeight={70} placeholder="Optional sign-off…" /></div>
          </CardContent>
        </Card>
        <PreviewPane subject={subject} header={header} body={body} footer={footer} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Recipients</span>
              <span className="text-xs font-normal text-muted-foreground">{selectedClients.size} selected</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" className="pl-8" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} /> Select all ({filtered.length})
            </label>
            <div className="max-h-[360px] overflow-auto space-y-0.5 pr-1">
              {filtered.map(c => {
                const email = emailOf(c);
                return (
                  <label key={c.id} className={`flex items-start gap-2 px-2 py-1.5 rounded text-sm ${email ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50'}`}>
                    <Checkbox checked={selectedClients.has(c.id)} disabled={!email} onCheckedChange={() => email && toggle(c.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{c.companyName}</span>
                      <span className="block text-xs text-muted-foreground truncate">{email || 'No email on file'}</span>
                    </span>
                  </label>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground px-2 py-3">No matching clients.</p>}
            </div>
            <Button className="w-full gap-2" loading={sendBulk.isPending} loadingText="Sending…" onClick={send}>
              <Send className="h-4 w-4" /> Send to {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Invoice themes tab ───────────────────────────────────────────────────────────
function InvoiceThemesTab() {
  const { data: themes, isLoading, isError, refetch } = useInvoiceTemplates();
  const createTheme = useCreateInvoiceTemplate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = themes?.find(t => t.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoice themes</CardTitle>
          <Button size="sm" variant="outline" className="gap-1.5" loading={createTheme.isPending}
            onClick={async () => {
              try { const t = await createTheme.mutateAsync({ name: 'New theme', accentColor: '#2563EB', headerStyle: 'plain' }); setSelectedId(t.id); }
              catch { toast.error('Could not create theme'); }
            }}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isError && (
            <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-xs text-red-500">Failed to load themes.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
            </div>
          )}
          {!isError && (themes ?? []).map(t => (
            <button key={t.id} type="button" onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${selectedId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
              <span className="inline-block h-3 w-3 rounded-full border" style={{ background: t.accentColor }} />
              <span className="font-medium">{t.name}</span>
              {t.isDefault && <span className="ml-auto text-[10px] uppercase tracking-wide text-emerald-600">Default</span>}
            </button>
          ))}
        </CardContent>
      </Card>
      {selected ? <ThemeEditor key={selected.id} theme={selected} onDeleted={() => setSelectedId(null)} />
        : <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Select a theme to edit, or create a new one.</CardContent></Card>}
    </div>
  );
}

function ThemeEditor({ theme, onDeleted }: { theme: InvoiceTemplate; onDeleted: () => void }) {
  const updateTheme = useUpdateInvoiceTemplate(theme.id);
  const deleteTheme = useDeleteInvoiceTemplate();
  const [name, setName] = useState(theme.name);
  const [accentColor, setAccentColor] = useState(theme.accentColor);
  const [headerStyle, setHeaderStyle] = useState<'plain' | 'band'>(theme.headerStyle);
  const [footerText, setFooterText] = useState(theme.footerText);
  const [isDefault, setIsDefault] = useState(theme.isDefault);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Edit theme</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" loading={deleteTheme.isPending}
            onClick={async () => { try { await deleteTheme.mutateAsync(theme.id); toast.success('Theme deleted'); onDeleted(); } catch { toast.error('Delete failed'); } }}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button size="sm" className="gap-1.5" loading={updateTheme.isPending} loadingText="Saving…"
            onClick={async () => {
              if (!name.trim()) { toast.error('Name is required'); return; }
              try { await updateTheme.mutateAsync({ name, accentColor, headerStyle, footerText, isDefault }); toast.success('Theme saved'); }
              catch { toast.error('Save failed'); }
            }}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Theme name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Accent color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-9 w-12 rounded border p-0.5" />
              <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Header style</Label>
            <Select value={headerStyle} onValueChange={v => setHeaderStyle(v as 'plain' | 'band')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain (white header)</SelectItem>
                <SelectItem value="band">Band (accent stripe on top)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Footer text</Label><Input value={footerText} onChange={e => setFooterText(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={isDefault} onCheckedChange={v => setIsDefault(!!v)} /> Use as the default theme for new invoices</label>
        <div className="rounded-lg border overflow-hidden">
          {headerStyle === 'band' && <div style={{ height: 6, background: accentColor }} />}
          <div className="p-4 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg" style={{ color: accentColor }}>INVOICE</span>
              <span className="text-sm text-gray-500">Jobly Solutions</span>
            </div>
            <div className="mt-3 rounded text-white text-xs font-semibold px-3 py-1.5" style={{ background: accentColor }}>Description · Qty · Unit price · Amount</div>
            <p className="mt-3 text-[11px] text-gray-400 text-center">{footerText || 'Footer'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmailTemplates() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl sm:text-2xl font-semibold">Templates</h1>
      </div>
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Email templates</TabsTrigger>
          <TabsTrigger value="compose">Email clients</TabsTrigger>
          <TabsTrigger value="themes">Invoice themes</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        <TabsContent value="compose" className="mt-4"><ComposeTab /></TabsContent>
        <TabsContent value="themes" className="mt-4"><InvoiceThemesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
