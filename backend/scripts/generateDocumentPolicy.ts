/**
 * Regenerate FALLBACK_POLICY in src/lib/documentPolicy.ts from the structures
 * that govern documents today.
 *
 *   npx tsx scripts/generateDocumentPolicy.ts            # rewrite the fallback
 *   npx tsx scripts/generateDocumentPolicy.ts --sql      # also emit the seed
 *
 * Written in TypeScript and run with tsx so it can IMPORT the frontend's
 * documentTypes.ts rather than parse it. The permissions generator had to read
 * route files as text and that cost three rounds of invisible routes; this one
 * does not have to guess, because contracts.test.ts already proves the two
 * trees can import each other (both modules are pure, with no DB imports).
 *
 * The policy it produces collapses SIX overlapping sources into one answer per
 * (document, work status):
 *
 *   ROW_VISA_EXCLUDE          deny-list, beats everything
 *   ROW_VISA_GATE             allow-list, absent key = everyone
 *   inline wizard rules       NewEmployee.tsx — in no table at all
 *   getRequiredIdentityTypes  the required union
 *   EMPLOYER_ROW_VISA_GATE    employer rows, absent key = nobody
 *   EMPLOYER_DOC_ROWS         which documents the employer issues
 *
 * Those can contradict each other today, and have: the Green Card fix took
 * three passes because i140 was gated one way while i140_questionnaire was
 * excluded another. One cell with one value cannot.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  IDENTITY_DOC_ROWS,
  EMPLOYER_DOC_ROWS,
  ROW_VISA_GATE,
  ROW_VISA_EXCLUDE,
  EMPLOYER_ROW_VISA_GATE,
  getRequiredIdentityTypes,
  categoryOf,
} from '../../src/portal/lib/documentTypes';

/** Every work status an employee can hold — the enum the UI offers. */
export const VISA_TYPES = [
  'h1b', 'l1', 'l2', 'opt', 'stem_opt', 'gc', 'citizen', 'tn', 'h4_ead', 'other',
] as const;

export type DocState = 'required' | 'optional' | 'hidden';

/**
 * Rules the wizard applies INLINE, before consulting any table
 * (src/portal/pages/NewEmployee.tsx). They are policy, they are in no
 * structure, and nothing tests them against the tables — which is exactly why
 * they belong in the catalogue.
 */
function inlineWizardRule(docType: string, visa: string): DocState | null {
  // The OPT and STEM OPT cards ARE the EAD. Never a row of their own.
  if (docType === 'opt_card' || docType === 'stem_opt_card') return 'hidden';
  // I-983 and I-20 are F-1 instruments.
  if (docType === 'i983' || docType === 'i20') {
    return visa === 'opt' || visa === 'stem_opt' ? null : 'hidden';
  }
  return null;
}

/** What the code does today for one document and one work status. */
export function deriveState(docType: string, visa: string, isEmployerRow: boolean): DocState {
  if (isEmployerRow) {
    // Employer rows have the OPPOSITE default to employee rows: an absent key
    // means never shown, not always shown. Getting that backwards would reveal
    // sponsorship paperwork on every record.
    const gate = EMPLOYER_ROW_VISA_GATE[docType];
    if (!gate || !gate.includes(visa)) return 'hidden';
    // Never 'required': an employee cannot produce an LCA, and demanding one
    // would make onboarding impossible to finish.
    return 'optional';
  }

  const inline = inlineWizardRule(docType, visa);
  if (inline) return inline;

  if ((ROW_VISA_EXCLUDE[docType] ?? []).includes(visa)) return 'hidden';
  const gate = ROW_VISA_GATE[docType];
  if (gate && !gate.includes(visa)) return 'hidden';

  return getRequiredIdentityTypes(visa).includes(docType) ? 'required' : 'optional';
}

export interface PolicyRow {
  key: string;
  label: string;
  issuedBy: 'employee' | 'employer';
  hasExpiry: boolean;
  /** Grouping, so related paperwork sits together on every surface. */
  category: string;
  states: Record<string, DocState>;
}

export function buildPolicy(): PolicyRow[] {
  const rows: PolicyRow[] = [];
  for (const row of IDENTITY_DOC_ROWS) {
    const states: Record<string, DocState> = {};
    for (const v of VISA_TYPES) states[v] = deriveState(row.type, v, false);
    rows.push({
      key: row.type, label: row.label, issuedBy: 'employee',
      hasExpiry: !!row.hasExpiry, category: categoryOf(row.type, 'employee'), states,
    });
  }
  for (const row of EMPLOYER_DOC_ROWS) {
    const states: Record<string, DocState> = {};
    for (const v of VISA_TYPES) states[v] = deriveState(row.type, v, true);
    rows.push({
      key: row.type, label: row.label, issuedBy: 'employer',
      hasExpiry: !!row.hasExpiry, category: categoryOf(row.type, 'employer'), states,
    });
  }
  return rows;
}

// ── emit ────────────────────────────────────────────────────────────────────

// Relative to the backend root, where this script is documented to run from:
// import.meta.dirname is undefined under tsx's transpile.
const OUT = path.join(process.cwd(), 'src', 'lib', 'documentPolicy.ts');

function toLiteral(rows: PolicyRow[]): string {
  return rows.map(r => {
    const states = VISA_TYPES.map(v => `${v}: '${r.states[v]}'`).join(', ');
    return `  '${r.key}': { label: ${JSON.stringify(r.label)}, issuedBy: '${r.issuedBy}', hasExpiry: ${r.hasExpiry}, category: '${r.category}',\n    states: { ${states} } },`;
  }).join('\n');
}

function toSeedSql(rows: PolicyRow[]): string {
  const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  const types = rows.map(r =>
    `  (${q(r.key)}, ${q(r.label)}, ${q(r.issuedBy)}, ${r.hasExpiry}, ${q(r.category)})`).join(',\n');
  const reqs: string[] = [];
  for (const r of rows) {
    for (const v of VISA_TYPES) reqs.push(`  (${q(r.key)}, ${q(v)}, ${q(r.states[v])})`);
  }
  return `INSERT INTO public.document_types (key, label, issued_by, has_expiry, category) VALUES\n${types}\nON CONFLICT (key) DO NOTHING;\n\nINSERT INTO public.document_requirements (document_key, visa_type, state) VALUES\n${reqs.join(',\n')}\nON CONFLICT (document_key, visa_type) DO NOTHING;\n`;
}

if (process.argv[1]?.includes('generateDocumentPolicy')) {
  const rows = buildPolicy();
  let src = fs.readFileSync(OUT, 'utf8');
  src = src.replace(
    // Matches the empty one-line placeholder as well as an already-populated
    // block, so the first run works and every later one replaces cleanly.
    /export const FALLBACK_POLICY: Record<string, PolicyEntry> = Object\.freeze\(\{[\s\S]*?\}\);/,
    `export const FALLBACK_POLICY: Record<string, PolicyEntry> = Object.freeze({\n${toLiteral(rows)}\n});`,
  );
  fs.writeFileSync(OUT, src);

  const counts = { required: 0, optional: 0, hidden: 0 };
  for (const r of rows) for (const v of VISA_TYPES) counts[r.states[v]]++;
  console.log(`documents: ${rows.length} | work statuses: ${VISA_TYPES.length} | cells: ${rows.length * VISA_TYPES.length}`);
  console.log(`  required ${counts.required} · optional ${counts.optional} · hidden ${counts.hidden}`);

  if (process.argv.includes('--sql')) {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '055_document_policy_seed.sql');
    fs.writeFileSync(sqlPath, fs.readFileSync(sqlPath, 'utf8').split('-- SEED')[0] + '-- SEED\n\n' + toSeedSql(rows));
    console.log('seed written to 055_document_policy_seed.sql');
  }
}
