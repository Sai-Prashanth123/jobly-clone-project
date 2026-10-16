import { supabaseAdmin } from '../config/supabase';
import {
  VISA_REQUIRED_EXTRA_DOCS,
  VISA_TYPES_REQUIRING_PASSPORT_I94,
  VISA_CONDITIONAL_REQUIRED_DOCS,
  ONBOARDING_REQUIRED_DOCS,
  DOC_TYPE_LEGACY_ALIASES,
  IDENTITY_DOC_TYPE_LABELS,
} from '../lib/onboarding';
import { EMPLOYER_MANAGED_DOC_TYPES } from '../lib/employerDocs';

/**
 * What each work-status category requires, against what people in it actually
 * hold.
 *
 * HR: *"The documents listed under each category still have some gaps, we can
 * have one more call and finalize."* The Yes/No opt-out shipped and makes the
 * gaps survivable — nobody is blocked by a document that does not apply to
 * them. It does not make them VISIBLE: a document that genuinely should be
 * required and is not on the list is one nobody is ever asked for, and nothing
 * says so.
 *
 * This answers that from the data rather than from memory. It cannot say what
 * the right answer is — only Jagan can — but it can say which questions are
 * worth asking, with names and counts, before the call rather than during it.
 *
 * Deliberately a READ-ONLY report. It changes no policy and blocks nobody.
 */

/** A document most of a category holds, that the category does not require. */
export interface CandidateGap {
  visaType: string;
  documentType: string;
  heldBy: number;
  categorySize: number;
  /** 0-100. High means "almost everyone files this, yet nothing asks for it". */
  heldPercent: number;
}

/** A document the category requires that most of it is missing. */
export interface UnmetRequirement {
  visaType: string;
  documentType: string;
  missingFor: number;
  categorySize: number;
}

/** A stored document name matching no known document and no known alias. */
export interface UnknownLabel {
  documentType: string;
  count: number;
  employees: string[];
}

export interface DocumentGapsReport {
  categories: Array<{ visaType: string; employees: number }>;
  candidateGaps: CandidateGap[];
  unmetRequirements: UnmetRequirement[];
  unknownLabels: UnknownLabel[];
  generatedAt: string;
}

/**
 * Every label the system recognises: a canonical document, or an alias of one.
 *
 * Built from the same maps the onboarding gate matches with, so "unknown here"
 * means exactly "invisible to the gate" rather than merely "unfamiliar".
 */
function knownLabels(): Set<string> {
  const known = new Set<string>(Object.values(IDENTITY_DOC_TYPE_LABELS));
  // Employer-issued documents live in their own list, not in the identity
  // rows. Leaving them out made the report call "E-Verify Letter" — five of
  // them, perfectly well recognised everywhere else — an unknown label. The
  // first run against live data caught it, which is why that run happened.
  for (const label of EMPLOYER_MANAGED_DOC_TYPES) known.add(label);
  for (const [canonical, aliases] of Object.entries(DOC_TYPE_LEGACY_ALIASES)) {
    known.add(canonical);
    for (const a of aliases) known.add(a);
  }
  return known;
}

/** Does this employee hold the document, under any name the gate accepts? */
function holds(held: Set<string>, label: string): boolean {
  if (held.has(label)) return true;
  return (DOC_TYPE_LEGACY_ALIASES[label] ?? []).some(alias => held.has(alias));
}

/** What a visa type demands today — the same union computeOnboarding builds. */
export function requiredFor(visaType: string): string[] {
  const conditional = VISA_TYPES_REQUIRING_PASSPORT_I94.has(visaType)
    ? [...VISA_CONDITIONAL_REQUIRED_DOCS]
    : [];
  const extra = VISA_REQUIRED_EXTRA_DOCS[visaType] ?? [];
  return [...new Set([...ONBOARDING_REQUIRED_DOCS, ...conditional, ...extra])];
}

/**
 * `legal` may only see employees it has a case with — never the full roster.
 * Mirrors legalScopedEmployeeIds in employees.service.ts.
 */
async function scopedEmployeeIds(viewerRole: string): Promise<string[] | undefined> {
  if (viewerRole !== 'legal') return undefined;
  const { data } = await supabaseAdmin.from('cases').select('employee_id').is('deleted_at', null);
  return [...new Set((data ?? []).map(c => c.employee_id))];
}

/**
 * @param heldThreshold percent of a category that must hold a document before
 *   it counts as a candidate gap. 50 by default — a majority filing something
 *   nobody asked for is the signal worth looking at.
 */
export async function buildDocumentGapsReport(
  viewerRole = 'admin',
  heldThreshold = 50,
): Promise<DocumentGapsReport> {
  const scopedIds = await scopedEmployeeIds(viewerRole);
  const empty: DocumentGapsReport = {
    categories: [], candidateGaps: [], unmetRequirements: [], unknownLabels: [],
    generatedAt: new Date().toISOString(),
  };
  if (scopedIds && scopedIds.length === 0) return empty;

  let empQuery = supabaseAdmin
    .from('employees')
    .select('id,display_id,visa_type')
    .is('deleted_at', null)
    .in('status', ['active', 'inactive', 'onboarding']);
  if (scopedIds) empQuery = empQuery.in('id', scopedIds);
  const { data: employees } = await empQuery;
  if (!employees?.length) return empty;

  let docQuery = supabaseAdmin
    .from('documents')
    .select('entity_id,type')
    .eq('entity_type', 'employee');
  if (scopedIds) docQuery = docQuery.in('entity_id', scopedIds);
  const { data: docs } = await docQuery;

  // entity_id has no foreign key, so the join is done here.
  const heldByEmployee = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    if (!d.entity_id || !d.type) continue;
    if (!heldByEmployee.has(d.entity_id)) heldByEmployee.set(d.entity_id, new Set());
    heldByEmployee.get(d.entity_id)!.add(String(d.type));
  }

  // Employees with no work status set cannot be judged against a category.
  const byCategory = new Map<string, typeof employees>();
  for (const e of employees) {
    const v = e.visa_type;
    if (!v) continue;
    if (!byCategory.has(v)) byCategory.set(v, []);
    byCategory.get(v)!.push(e);
  }

  const candidateGaps: CandidateGap[] = [];
  const unmetRequirements: UnmetRequirement[] = [];

  for (const [visaType, members] of byCategory) {
    const required = new Set(requiredFor(visaType));
    const size = members.length;

    // How many of this category hold each document, counting aliases as the
    // canonical name so "EAD Copy" does not read as its own document.
    const canonicalOf = new Map<string, string>();
    for (const [canonical, aliases] of Object.entries(DOC_TYPE_LEGACY_ALIASES)) {
      for (const a of aliases) canonicalOf.set(a, canonical);
    }
    const holders = new Map<string, number>();
    for (const m of members) {
      const held = heldByEmployee.get(m.id) ?? new Set<string>();
      for (const raw of held) {
        const name = canonicalOf.get(raw) ?? raw;
        holders.set(name, (holders.get(name) ?? 0) + 1);
      }
    }

    for (const [documentType, heldBy] of holders) {
      if (required.has(documentType)) continue;
      // An employer-issued document can never become an employee requirement
      // — the employee cannot produce an E-Verify letter however many of them
      // are on file. Whether the COMPANY still owes one is a different
      // question, answered on the employee record itself.
      if (EMPLOYER_MANAGED_DOC_TYPES.has(documentType)) continue;
      const heldPercent = Math.round((heldBy / size) * 100);
      if (heldPercent < heldThreshold) continue;
      candidateGaps.push({ visaType, documentType, heldBy, categorySize: size, heldPercent });
    }

    for (const documentType of required) {
      const missingFor = members.filter(
        m => !holds(heldByEmployee.get(m.id) ?? new Set<string>(), documentType),
      ).length;
      if (missingFor === 0) continue;
      unmetRequirements.push({ visaType, documentType, missingFor, categorySize: size });
    }
  }

  // Names the gate cannot see at all. These are a data problem, not a policy
  // one: the employee uploaded the document and is still being asked for it.
  const known = knownLabels();
  const unknown = new Map<string, { count: number; employees: Set<string> }>();
  const displayIdOf = new Map(employees.map(e => [e.id, e.display_id ?? e.id]));
  for (const d of docs ?? []) {
    const label = d.type ? String(d.type) : '';
    if (!label || known.has(label)) continue;
    if (!unknown.has(label)) unknown.set(label, { count: 0, employees: new Set() });
    const entry = unknown.get(label)!;
    entry.count++;
    const who = displayIdOf.get(d.entity_id);
    if (who) entry.employees.add(who);
  }

  return {
    categories: [...byCategory.entries()]
      .map(([visaType, m]) => ({ visaType, employees: m.length }))
      .sort((a, b) => b.employees - a.employees),
    candidateGaps: candidateGaps.sort(
      (a, b) => b.heldPercent - a.heldPercent || a.visaType.localeCompare(b.visaType),
    ),
    unmetRequirements: unmetRequirements.sort(
      (a, b) => b.missingFor - a.missingFor || a.visaType.localeCompare(b.visaType),
    ),
    unknownLabels: [...unknown.entries()]
      .map(([documentType, v]) => ({ documentType, count: v.count, employees: [...v.employees] }))
      .sort((a, b) => b.count - a.count),
    generatedAt: new Date().toISOString(),
  };
}
