import { supabaseAdmin } from '../config/supabase';
import {
  buildPolicyIndex, wouldEmptyCategory, FALLBACK_POLICY, VISA_TYPES,
  type PolicyRow, type DocState,
} from '../lib/documentPolicy';
import { logActivity } from '../lib/activityLogger';
import {
  ONBOARDING_REQUIRED_DOCS,
  VISA_CONDITIONAL_REQUIRED_DOCS,
  IDENTITY_DOC_TYPE_LABELS,
} from '../lib/onboarding';

/**
 * Reading and writing the document-policy tables.
 *
 * Modelled on permissions.service.ts, which is the proven shape in this
 * codebase: a short-TTL cache so the read path costs nothing per request, a
 * failure that degrades to the compiled-in policy rather than to an outage,
 * and an audit entry that records what a value WAS as well as what it became.
 */

const CACHE_TTL_MS = 30_000;

let cache: { at: number; rows: PolicyRow[] } | null = null;
let inFlight: Promise<PolicyRow[]> | null = null;

async function loadRows(): Promise<PolicyRow[]> {
  const { data, error } = await supabaseAdmin
    .from('document_requirements')
    .select('document_key, visa_type, state');

  // A database problem must not become an outage and must not become a
  // free-for-all. Returning [] hands every document to the compiled-in
  // fallback, which is what the wizard and the onboarding gate enforce today.
  if (error) {
    console.error('[documentPolicy.service] could not read document_requirements; using the code', error);
    return [];
  }
  return (data ?? []) as PolicyRow[];
}

export async function getRows(force = false): Promise<PolicyRow[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  if (!inFlight) {
    inFlight = loadRows()
      .then(rows => { cache = { at: Date.now(), rows }; inFlight = null; return rows; })
      .catch(err => { inFlight = null; throw err; });
  }
  return inFlight;
}

export function invalidate(): void { cache = null; }

/** What this work status needs from this document, right now. */
export async function stateOf(documentKey: string, visaType: string): Promise<DocState> {
  const index = buildPolicyIndex(await getRows(), FALLBACK_POLICY);
  return index(documentKey, visaType);
}

/**
 * The whole policy, shaped for the wizard and the onboarding gate.
 *
 * One endpoint serves both apps, which is the point: the frontend and backend
 * each kept their own copy of these lists, keyed differently — by row type on
 * one side and by label on the other — and a test existed solely to stop the
 * two drifting.
 */
export async function getPolicy(): Promise<{
  documents: Array<{
    key: string; label: string; issuedBy: string; hasExpiry: boolean; aliases: string[];
    states: Record<string, DocState>;
  }>;
  visaTypes: string[];
}> {
  const [rows, types] = await Promise.all([
    getRows(),
    supabaseAdmin.from('document_types').select('key, label, issued_by, has_expiry, aliases, sort_order'),
  ]);
  const index = buildPolicyIndex(rows, FALLBACK_POLICY);

  // The table when it has one, the compiled-in list when it does not — so a
  // fresh or unreachable database still describes every document.
  const stored = (types.data ?? []) as Array<{
    key: string; label: string; issued_by: string; has_expiry: boolean;
    aliases: string[] | null; sort_order: number;
  }>;
  const source = stored.length
    ? stored.map(t => ({
        key: t.key, label: t.label, issuedBy: t.issued_by,
        hasExpiry: t.has_expiry, aliases: t.aliases ?? [], sort: t.sort_order,
      }))
    : Object.entries(FALLBACK_POLICY).map(([key, e], i) => ({
        key, label: e.label, issuedBy: e.issuedBy, hasExpiry: e.hasExpiry, aliases: [], sort: i,
      }));

  return {
    documents: source
      .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key))
      .map(d => ({
        key: d.key, label: d.label, issuedBy: d.issuedBy, hasExpiry: d.hasExpiry,
        aliases: d.aliases,
        states: Object.fromEntries(VISA_TYPES.map(v => [v, index(d.key, v)])) as Record<string, DocState>,
      })),
    visaTypes: [...VISA_TYPES],
  };
}

/** Change one cell. */
export async function setState(
  change: PolicyRow,
  actorId?: string,
): Promise<{ warning?: string }> {
  const rows = await getRows(true);
  const before = rows.find(
    r => r.document_key === change.document_key && r.visa_type === change.visa_type,
  );

  const { error } = await supabaseAdmin
    .from('document_requirements')
    .upsert(
      { ...change, updated_at: new Date().toISOString() },
      { onConflict: 'document_key,visa_type' },
    );
  if (error) throw error;

  invalidate();

  await logActivity(
    actorId ?? null,
    'permission_changed',
    'document_requirement',
    `${change.document_key}:${change.visa_type}`,
    `${change.document_key} · ${change.visa_type}`,
    {
      document: change.document_key,
      visaType: change.visa_type,
      from: before ? before.state : '(unset - was using the code default)',
      to: change.state,
    },
  );

  // Not refused — `citizen` legitimately requires only the universal four —
  // but worth saying out loud, because the usual way to arrive at a category
  // that demands nothing is a mis-click rather than a decision.
  if (wouldEmptyCategory(rows, change)) {
    return { warning: `No document is now required for ${change.visa_type}. Onboarding will complete without any category-specific paperwork.` };
  }
  return {};
}

/** Add or remove a spelling the same document has been filed under. */
export async function setAliases(
  documentKey: string,
  aliases: string[],
  actorId?: string,
): Promise<void> {
  const { data: before } = await supabaseAdmin
    .from('document_types').select('aliases').eq('key', documentKey).maybeSingle();

  const { error } = await supabaseAdmin
    .from('document_types')
    .update({ aliases })
    .eq('key', documentKey);
  if (error) throw error;

  invalidate();

  await logActivity(
    actorId ?? null,
    'permission_changed',
    'document_requirement',
    `${documentKey}:aliases`,
    `${documentKey} · aliases`,
    { document: documentKey, from: (before as { aliases?: string[] } | null)?.aliases ?? [], to: aliases },
  );
}

/**
 * The per-visa documents a work status requires, BY LABEL — the shape
 * computeOnboarding wants.
 *
 * Only the extras: the universal four and the passport/visa/I-94 set are
 * handled by their own blocks in the gate, and returning them here would make
 * a document appear twice in the "still required" message.
 */
export async function policyExtrasFor(visaType: string): Promise<string[] | undefined> {
  if (!visaType) return undefined;
  const rows = await getRows();
  // Nothing stored yet: let the gate use its compiled-in list rather than
  // computing an empty requirement set from an empty table.
  if (rows.length === 0) return undefined;

  const index = buildPolicyIndex(rows, FALLBACK_POLICY);
  const universal = new Set<string>(ONBOARDING_REQUIRED_DOCS);
  const conditional = new Set<string>(VISA_CONDITIONAL_REQUIRED_DOCS);

  const labels: string[] = [];
  for (const key of Object.keys(FALLBACK_POLICY)) {
    if (index(key, visaType) !== 'required') continue;
    const label = IDENTITY_DOC_TYPE_LABELS[key];
    if (!label) continue;                        // employer rows have no entry
    if (universal.has(label) || conditional.has(label)) continue;
    labels.push(label);
  }
  return labels;
}
