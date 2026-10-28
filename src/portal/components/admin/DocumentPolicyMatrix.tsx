import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Building2, ChevronDown, Loader2, Tag, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useDocumentPolicy, useSetDocumentState, useSetDocumentAliases, useSetDocumentCategory,
  type DocState, type PolicyDocument,
} from '../../hooks/useDocumentPolicy';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_ORDER } from '../../lib/documentTypes';

/**
 * Which documents each work status needs — editable.
 *
 * HR: *"The documents listed under each category still have some gaps, we can
 * have one more call and finalize."* A call fixes today's gaps; it does not
 * fix the next ones, because changing a list meant a developer and a deploy.
 * This is the screen that removes that loop.
 *
 * Three states per cell, and they are not arbitrary — they ARE the three
 * mechanisms the code used to express separately, in structures that could
 * contradict each other:
 *
 *   Required        must be uploaded to finish onboarding
 *   Optional        shown, and the employee may answer "no"
 *   Not applicable  not shown at all
 */

const VISA_LABELS: Record<string, string> = {
  h1b: 'H-1B', l1: 'L-1', l2: 'L-2', opt: 'OPT', stem_opt: 'STEM OPT',
  gc: 'Green Card', citizen: 'Citizen', tn: 'TN', h4_ead: 'H-4 EAD', other: 'Other',
};
const visaLabel = (v: string) => VISA_LABELS[v] ?? v;

const STATE_LABEL: Record<DocState, string> = {
  required: 'Required',
  optional: 'Optional',
  hidden: 'Not applicable',
};

function stateClass(s: DocState): string {
  if (s === 'required') return 'text-red-700 bg-red-50 border-red-200';
  if (s === 'optional') return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-gray-400 bg-gray-50 border-gray-200';
}

export function DocumentPolicyMatrix() {
  const { data, isLoading, isError } = useDocumentPolicy();
  const setState = useSetDocumentState();
  const setAliases = useSetDocumentAliases();

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [aliasFor, setAliasFor] = useState<PolicyDocument | null>(null);

  // Employee documents first — they are what the wizard asks for and what
  // anyone opening this screen came to change. Employer-issued paperwork is a
  // different conversation and sits underneath.
  // Grouped by subject rather than by who issues the document. The old
  // two-way employee/employer split put a passport, a PERM questionnaire and a
  // pay stub in one undifferentiated list of 33 — which is how two rows for
  // the LCA, one on each side of that split, went unnoticed. Employer-issued
  // paperwork is still its own group, and still last.
  const groups = useMemo(() => {
    const byCategory = new Map<string, PolicyDocument[]>();
    for (const d of data?.documents ?? []) {
      const cat = d.category || 'project';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(d);
    }
    return [...byCategory.entries()]
      .map(([key, docs]) => ({ key, name: DOCUMENT_CATEGORY_LABELS[key] ?? key, docs }))
      .sort((a, b) => (DOCUMENT_CATEGORY_ORDER[a.key] ?? 99) - (DOCUMENT_CATEGORY_ORDER[b.key] ?? 99));
  }, [data]);

  const setCategory = useSetDocumentCategory();

  const moveTo = (doc: PolicyDocument, category: string) => {
    setCategory.mutate({ key: doc.key, category }, {
      onSuccess: () => toast.success(`${doc.label} moved to ${DOCUMENT_CATEGORY_LABELS[category] ?? category}`),
      onError: () => toast.error(`Could not move ${doc.label}`),
    });
  };

  const change = (doc: PolicyDocument, visa: string, next: DocState) => {
    const id = `${doc.key}\u0000${visa}`;
    setPending(id);
    setState.mutate(
      { document_key: doc.key, visa_type: visa, state: next },
      {
        onSuccess: res => {
          toast.success(`${doc.label} is now ${STATE_LABEL[next].toLowerCase()} for ${visaLabel(visa)}`);
          // The server flags a category left requiring nothing. Not refused —
          // Citizen legitimately requires only the universal documents — but
          // the usual way to arrive there is a mis-click.
          if (res?.warning) toast.warning(res.warning, { duration: 8000 });
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { error?: string } } };
          toast.error(e.response?.data?.error ?? 'That change could not be saved.');
        },
        onSettled: () => setPending(null),
      },
    );
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading the document policy…
    </div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">The document policy could not be loaded.</p>
        <p className="text-xs text-amber-800 mt-1">
          Onboarding is unaffected — it falls back to the rules built into the application
          when this table cannot be read.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground max-w-3xl">
        What each work status is asked for. A change takes effect on the next onboarding
        form — no deploy. <strong>Required</strong> blocks completion until the document is
        uploaded; <strong>Optional</strong> shows the row and lets the employee answer "no";
        <strong> Not applicable</strong> hides it entirely.{' '}
        {data.documents.length} documents × {data.visaTypes.length} work statuses.
      </p>

      {groups.map(group => {
        const isOpen = open.has(group.name);
        return (
          <div key={group.key} className="rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(s => {
                const n = new Set(s);
                if (n.has(group.name)) n.delete(group.name); else n.add(group.name);
                return n;
              })}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                {group.key === 'employer' && <Building2 className="h-3.5 w-3.5 text-gray-400" />}
                {group.name}
              </span>
              <span className="text-[11px] text-gray-500">{group.docs.length}</span>
            </button>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-t border-gray-100">
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-white">
                        Document
                      </th>
                      {data.visaTypes.map(v => (
                        <th key={v} className="px-2 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center whitespace-nowrap">
                          {visaLabel(v)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.docs.map(doc => (
                      <tr key={doc.key} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-2 sticky left-0 bg-white">
                          <span className="text-sm text-gray-900">{doc.label}</span>
                          <span className="block text-[10px] font-mono text-gray-400">{doc.key}</span>
                          <button
                            type="button"
                            onClick={() => setAliasFor(doc)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#4069FF]"
                          >
                            <Tag className="h-3 w-3" />
                            {doc.aliases.length
                              ? `${doc.aliases.length} other name${doc.aliases.length === 1 ? '' : 's'}`
                              : 'add another name'}
                          </button>
                          {/* Regrouping is presentation only — it moves where
                              the document appears, never whether it is
                              required — so it saves straight away with no
                              confirmation. */}
                          <Select value={doc.category || 'project'} onValueChange={val => moveTo(doc, val)}>
                            <SelectTrigger
                              className="h-6 mt-1 text-[10px] border-dashed text-gray-500"
                              aria-label={`Group for ${doc.label}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_CATEGORIES.map(c => (
                                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {data.visaTypes.map(v => {
                          const id = `${doc.key}\u0000${v}`;
                          const value = doc.states[v] ?? 'hidden';
                          return (
                            <td key={v} className="px-2 py-2 text-center">
                              {pending === id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                              ) : doc.issuedBy === 'employer' ? (
                                // An employee cannot produce an LCA whatever a
                                // dropdown says, so Required is not offered here.
                                <Select value={value} onValueChange={val => change(doc, v, val as DocState)}>
                                  <SelectTrigger className={`h-7 text-[11px] ${stateClass(value)}`} aria-label={`${doc.label} for ${visaLabel(v)}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="optional">Tracked</SelectItem>
                                    <SelectItem value="hidden">Not applicable</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Select value={value} onValueChange={val => change(doc, v, val as DocState)}>
                                  <SelectTrigger className={`h-7 text-[11px] ${stateClass(value)}`} aria-label={`${doc.label} for ${visaLabel(v)}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="required">Required</SelectItem>
                                    <SelectItem value="optional">Optional</SelectItem>
                                    <SelectItem value="hidden">Not applicable</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <AliasDialog
        doc={aliasFor}
        onClose={() => setAliasFor(null)}
        busy={setAliases.isPending}
        onSave={(key, aliases) => setAliases.mutate({ key, aliases }, {
          onSuccess: () => { toast.success('Other names updated.'); setAliasFor(null); },
          onError: (e: unknown) => toast.error(
            (e as { response?: { data?: { error?: string } } }).response?.data?.error
            ?? 'Those names could not be saved.',
          ),
        })}
      />
    </div>
  );
}

/**
 * The other names a document has been filed under.
 *
 * documents.type is free text, so one document collects spellings — "EAD
 * Copy", "I-20 copy", "SN copy". A spelling the system does not know is
 * invisible to the onboarding check, and the employee is asked to upload
 * something they have already uploaded. The Document Gaps report lists the
 * ones currently unrecognised; this is where they get attached.
 */
function AliasDialog({
  doc, onClose, onSave, busy,
}: {
  doc: PolicyDocument | null;
  onClose: () => void;
  onSave: (key: string, aliases: string[]) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState('');
  const current = doc?.aliases ?? [];

  return (
    <Dialog open={!!doc} onOpenChange={o => { if (!o && !busy) { setDraft(''); onClose(); } }}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader><DialogTitle>Other names for {doc?.label}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {current.length === 0 && (
              <p className="text-xs text-gray-400">No other names recorded.</p>
            )}
            {current.map(a => (
              <Badge key={a} variant="secondary" className="gap-1">
                {a}
                <button
                  type="button"
                  aria-label={`Remove ${a}`}
                  className="text-gray-400 hover:text-red-600"
                  onClick={() => doc && onSave(doc.key, current.filter(x => x !== a))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Add a name</Label>
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="EAD Copy"
              onKeyDown={e => {
                if (e.key === 'Enter' && draft.trim() && doc) {
                  onSave(doc.key, [...current, draft.trim()]);
                  setDraft('');
                }
              }}
            />
          </div>
          <div className="flex gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
            <TriangleAlert className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900">
              A document already uploaded under one of these names starts counting
              immediately — nobody is asked for it again. Use the Document Gaps report
              to see which names are currently unrecognised.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDraft(''); onClose(); }}>Done</Button>
          <Button
            disabled={!draft.trim() || busy}
            loading={busy}
            onClick={() => { if (doc && draft.trim()) { onSave(doc.key, [...current, draft.trim()]); setDraft(''); } }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
