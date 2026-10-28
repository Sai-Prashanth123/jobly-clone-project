/**
 * Emit the category UPDATE statements for migration 058 from FALLBACK_POLICY.
 *
 *   npx tsx scripts/emitCategorySeed.ts
 *
 * The categories themselves live in the frontend's documentTypes.ts and reach
 * FALLBACK_POLICY through generateDocumentPolicy.ts, so this never invents a
 * value — it only reshapes the generated ones into SQL. UPDATE rather than
 * INSERT because document_types is already seeded; an upsert with
 * ON CONFLICT DO NOTHING would leave every existing row uncategorised.
 */
import { FALLBACK_POLICY } from '../src/lib/documentPolicy';

const byCategory = new Map<string, string[]>();
for (const [key, entry] of Object.entries(FALLBACK_POLICY)) {
  const cat = entry.category;
  if (!byCategory.has(cat)) byCategory.set(cat, []);
  byCategory.get(cat)!.push(key);
}

const out: string[] = [];
for (const [cat, keys] of byCategory) {
  const list = keys.map(k => `'${k}'`).join(', ');
  out.push(`UPDATE public.document_types SET category = '${cat}'\n  WHERE key IN (${list});`);
}

console.log(out.join('\n\n'));
console.log(`\n-- ${byCategory.size} categories across ${Object.keys(FALLBACK_POLICY).length} documents`);
