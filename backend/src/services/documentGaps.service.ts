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
import { FALLBACK_POLICY } from '../lib/documentPolicy';

/**
 * The display group a document belongs to, looked up by LABEL.
 *
 * Every finding in this report is keyed by label rather than by row type —
 * that is what the documents table stores — so the category has to come back
 * the same way. FALLBACK_POLICY carries both, which makes it the one place
 * that can answer this without a second mapping to keep in step.
 */
const CATEGORY_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(FALLBACK_POLICY).map(e => [e.label, e.category]),
);

function categoryForLabel(label: string): string {
  return CATEGORY_BY_LABEL[label] ?? 'project';
}

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
  /** Display group, so related findings sort together. */
  category: string;
  heldBy: number;
  categorySize: number;
  /** 0-100. High means "almost everyone files this, yet nothing asks for it". */
  heldPercent: number;
}

/** A document the category requires that most of it is missing. */
export interface UnmetRequirement {
  visaType: string;
  documentType: string;
  category: string;
  missingFor: number;
  categorySize: number;
}

/**
 * A document people in this category have explicitly said they do not have.
 *
 * This is the other half of the Yes/No opt-out. The toggle lets somebody
 * decline a document that does not apply to them, which stops them being
 * blocked — but until now nobody could see those answers, so a document the
 * whole category keeps declining looked exactly like a document nobody had got
 * round to uploading.
 */
export interface DeclaredNotHeld {
  visaType: string;
  documentType: string;
  category: string;
  declaredNo: number;
  categorySize: number;
  /** 0-100 of the category. */
  percent: number;
  /**
   * True when this document IS required for the category, i.e. the answer is
   * being correctly ignored by the onboarding gate.
   *
   * The invariant "a no can never satisfy a requirement" is asserted in unit
   * tests; this makes it OBSERVABLE in production. A row that lights up here
   * is a stale answer left over from a visa change, not a hole in the gate.
   */
  conflictsWithRequirement: boolean;
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
  declaredNotHeld: DeclaredNotHeld[];
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
/**
 * The "no" answers for one category, counted by document.
 *
 * Pure and exported so it can be tested directly; buildDocumentGapsReport
 * needs a database and this is the part with the decisions in it.
 */
export function declinedForCategory(
  visaType: string,
  members: Array<{ identity_documents?: unknown }>,
  required: Set<string>,
): DeclaredNotHeld[] {
  const size = members.length;
  if (size === 0) return [];

  const declined = new Map<string, number>();
  for (const m of members) {
    // Array.isArray rather than ?? [] — at least one production row holds an
    // object here rather than an array, and iterating it took a page down.
    const entries = Array.isArray(m.identity_documents) ? m.identity_documents : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as { type?: unknown; held?: unknown };
      if (row.held !== 'no' || typeof row.type !== 'string') continue;
      declined.set(row.type, (declined.get(row.type) ?? 0) + 1);
    }
  }

  const out: DeclaredNotHeld[] = [];
  for (const [rowType, declaredNo] of declined) {
    // Same reasoning as candidateGaps: an employer-issued document is never
    // the employee's to hold, so a "no" on one says nothing about policy.
    const documentType = IDENTITY_DOC_TYPE_LABELS[rowType] ?? rowType;
    if (EMPLOYER_MANAGED_DOC_TYPES.has(documentType)) continue;
    // Every count is reported, with no threshold. One person declining a
    // document the category should not be asking for is already the signal.
    out.push({
      visaType,
      documentType,
      category: categoryForLabel(documentType),
      declaredNo,
      categorySize: size,
      percent: Math.round((declaredNo / size) * 100),
      conflictsWithRequirement: required.has(documentType),
    });
  }
  return out;
}

export async function buildDocumentGapsReport(
  viewerRole = 'admin',
  heldThreshold = 50,
): Promise<DocumentGapsReport> {
  const scopedIds = await scopedEmployeeIds(viewerRole);
  const empty: DocumentGapsReport = {
    categories: [], candidateGaps: [], unmetRequirements: [], declaredNotHeld: [], unknownLabels: [],
    generatedAt: new Date().toISOString(),
  };
  if (scopedIds && scopedIds.length === 0) return empty;

  let empQuery = supabaseAdmin
    .from('employees')
    .select('id,display_id,visa_type,identity_documents')
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
  const declaredNotHeld: DeclaredNotHeld[] = [];

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
      candidateGaps.push({
        visaType, documentType, category: categoryForLabel(documentType),
        heldBy, categorySize: size, heldPercent,
      });
    }

    for (const documentType of required) {
      const missingFor = members.filter(
        m => !holds(heldByEmployee.get(m.id) ?? new Set<string>(), documentType),
      ).length;
      if (missingFor === 0) continue;
      unmetRequirements.push({
        visaType, documentType, category: categoryForLabel(documentType),
        missingFor, categorySize: size,
      });
    }

    declaredNotHeld.push(...declinedForCategory(visaType, members, required));
  }

  declaredNotHeld.sort((a, b) => b.declaredNo - a.declaredNo);

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
    declaredNotHeld,
    unknownLabels: [...unknown.entries()]
      .map(([documentType, v]) => ({ documentType, count: v.count, employees: [...v.employees] }))
      .sort((a, b) => b.count - a.count),
    generatedAt: new Date().toISOString(),
  };
}
