import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { storageProvider } from '../lib/storage';
import { mayReadDocument, type AccessibleDoc, type DocViewer } from '../lib/documentAccess';

/**
 * Who may read a given document.
 *
 * These endpoints take a document UUID directly, so this is the only gate —
 * whatever the UI does or does not show is irrelevant.
 *
 * - `admin` / `hr` — everything. They are the custodians of employee records.
 * - `employee`   — their own documents only, and NOT the employer-managed ones
 *                  (E-Verify letter, I-129, LCA...) which hang off their record
 *                  but belong to HR.
 * - `operations` / `finance` — everything EXCEPT employee documents. This is
 *                  the rule that was missing: the function used to return early
 *                  for every role except `employee`, so these two could mint a
 *                  signed URL for any SSN card, passport scan or bank letter by
 *                  UUID. That directly contradicted `redactEmployee`, which
 *                  deliberately blinds the same two roles to `ssn` and `bank_*`
 *                  on the JSON path — one door locked, the other wide open.
 *                  They keep client/invoice/case documents, which is what they
 *                  actually work with (contracts, invoice attachments).
 * - `legal`      — case-scoped, enforced separately by
 *                  assertLegalCanAccessDocument at each call site.
 */
// The policy itself lives in lib/documentAccess.ts so the tests can import the
// real rule instead of re-stating it. This wrapper only turns it into the
// refusal. Same wording for every refusal: saying "restricted" rather than "not
// yours" would confirm the document exists.
function assertMayReadDocument(doc: AccessibleDoc, user: DocViewer): void {
  if (!mayReadDocument(doc, user)) {
    throw new ForbiddenError('You may only access your own documents');
  }
}

const BUCKET_MAP: Record<string, string> = {
  employee: 'employee-docs',
  client: 'client-docs',
  invoice: 'invoices',
  case: 'case-docs',
};

// `legal` may only reach a document when it's tied to a case: either the
// document itself is a case document, or it's an employee document for an
// employee who has at least one non-deleted case. Mirrors the scoping already
// applied to the `employee_documents` embed in cases.service.ts's getCase() —
// every document read/write path for `legal` must enforce this same rule so
// a raw document/employee UUID can't be used to bypass the case-scoping this
// role is restricted to everywhere else.
async function employeeHasCase(employeeId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function assertLegalCanAccessDocument(doc: { entity_type: string; entity_id: string }): Promise<void> {
  if (doc.entity_type === 'case') {
    const { data } = await supabaseAdmin.from('cases').select('id').eq('id', doc.entity_id).is('deleted_at', null).maybeSingle();
    if (!data) throw new ForbiddenError('This document is not linked to a case you can access');
    return;
  }
  if (doc.entity_type === 'employee' && await employeeHasCase(doc.entity_id)) return;
  throw new ForbiddenError('This document is not linked to a case you can access');
}

export async function uploadDocument(
  entityType: 'employee' | 'client' | 'invoice' | 'case',
  entityId: string,
  file: Express.Multer.File,
  uploadedBy: string,
  nameOverride?: string,
  docTypeOverride?: string,
  expiryDate?: string | null,
  category?: string | null,
  // Single-slot rows (Offer Letter, W-4, I-20...) are a REPLACEMENT, not a
  // second copy: re-uploading is how someone corrects a wrong or outdated
  // file. Without this the old row stayed and admins saw both, with no way to
  // tell which one counts. Multi-file rows (passport pages) never pass this.
  replaceExisting?: boolean,
) {
  const bucket = BUCKET_MAP[entityType];
  // Strip everything but alphanumerics/dot/dash/underscore (incl. slashes and
  // "..") so a crafted originalname can't inject extra path segments into the
  // storage key.
  const storagePath = `${entityId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  await storageProvider.upload(bucket, storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  // Don't generate/store a signed URL here: it's an extra storage round-trip on
  // every upload (slows uploads) and the value expires in ~1h anyway. Downloads
  // always mint a fresh, download-forcing URL via getDocumentSignedUrl below
  // (GET /documents/:id/url).
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      name: nameOverride || file.originalname,
      type: docTypeOverride || file.mimetype,
      storage_path: storagePath,
      storage_url: null,
      uploaded_by: uploadedBy,
      expiry_date: expiryDate || null,
      category: category || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Retire the previous file(s) for this slot, but only AFTER the new row is
  // safely stored — deleting first would lose the old document if the upload
  // then failed, leaving the employee with neither.
  //
  // Best-effort: the replacement has already succeeded and been returned, so a
  // failure to tidy up must not fail the request. The worst case is the old
  // behaviour (a leftover duplicate), which is visible and fixable by hand.
  if (replaceExisting && doc?.id) {
    const slotType = docTypeOverride || file.mimetype;
    try {
      const { data: superseded } = await supabaseAdmin
        .from('documents')
        .select('id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('type', slotType)
        .neq('id', doc.id);
      for (const old of superseded ?? []) {
        await deleteDocument(old.id);
      }
    } catch (err) {
      console.error('[storage] failed to remove superseded documents for', entityId, slotType, err);
    }
  }

  return doc;
}

// Profile photos live in a dedicated PUBLIC bucket so the URL is permanent and
// renders in an <img> anywhere (employee list, detail header, sidebar, profile)
// without auth or expiry. The URL is written back onto employees.profile_photo_url.
export async function uploadEmployeePhoto(employeeId: string, file: Express.Multer.File) {
  const bucket = 'employee-photos';
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()
    || (file.mimetype === 'image/png' ? 'png' : 'jpg');
  const storagePath = `${employeeId}/${Date.now()}.${ext}`;

  // Clean up any previous photo files in this employee's folder so storage
  // doesn't accumulate orphan images on repeated uploads (#21 edge-case audit).
  // Best-effort: a cleanup failure must not block the upload.
  try {
    const existing = await storageProvider.list(bucket, `${employeeId}/`);
    if (existing && existing.length > 0) {
      await storageProvider.remove(bucket, existing.map(f => `${employeeId}/${f.name}`));
    }
  } catch (err) {
    console.error('[storage] employee photo cleanup failed for', employeeId, err);
  }

  await storageProvider.upload(bucket, storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  // Public bucket → permanent, unauthenticated URL (no expiry).
  const urlData = storageProvider.publicUrl(bucket, storagePath);
  const publicUrl = urlData;

  const { error: updErr } = await supabaseAdmin
    .from('employees')
    .update({ profile_photo_url: publicUrl })
    .eq('id', employeeId);
  if (updErr) throw updErr;

  return publicUrl;
}

// H-4 dependent passports live in the private `employee-docs` bucket (same one
// uploadDocument uses) rather than the public `employee-photos` bucket — these
// are sensitive PII, not a profile picture. Unlike a normal document, the file
// isn't a row in `documents`; it's tracked inline on the matching entry inside
// employees.dependents (JSONB), addressed by the dependent's client-generated id.
export async function uploadDependentPassport(
  employeeId: string,
  dependentId: string,
  file: Express.Multer.File,
) {
  const bucket = 'employee-docs';

  // Always read the CURRENT server-side array — never trust a copy carried in
  // the request body. This endpoint is only ever called (from NewEmployee.tsx)
  // strictly AFTER the main employee create/update PATCH has resolved, so this
  // read always sees that PATCH's result, not a stale pre-save array. That
  // ordering — never Promise.all'd against the main PATCH — is what prevents
  // the main save from clobbering the passportStoragePath this endpoint is
  // about to write (the main save's `dependents` payload was built from the
  // same server state this read just re-fetched, so splicing in one field here
  // and writing the whole array back cannot lose the other fields).
  const { data: emp, error: findErr } = await supabaseAdmin
    .from('employees')
    .select('dependents')
    .eq('id', employeeId)
    .single();
  if (findErr || !emp) throw new NotFoundError('Employee not found');

  const dependents = (emp.dependents ?? []) as Array<Record<string, unknown>>;
  const idx = dependents.findIndex(d => d.id === dependentId);
  if (idx === -1) throw new NotFoundError('Dependent not found');

  const storagePath = `${employeeId}/dependents/${dependentId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await storageProvider.upload(bucket, storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

  const nextDependents = dependents.map((d, i) =>
    i === idx ? { ...d, passportStoragePath: storagePath, passportFileName: file.originalname } : d,
  );
  const { error: updErr } = await supabaseAdmin
    .from('employees')
    .update({ dependents: nextDependents })
    .eq('id', employeeId);
  if (updErr) throw updErr;

  const urlData = await storageProvider.signedUrl(bucket, storagePath, 3600, { download: file.originalname });
  return { passportStoragePath: storagePath, passportFileName: file.originalname, signedUrl: urlData ?? null };
}

export async function getDependentPassportSignedUrl(
  employeeId: string,
  dependentId: string,
  user: { role: string; employeeId?: string | null },
) {
  if (user.role === 'employee' && user.employeeId !== employeeId) {
    throw new ForbiddenError('You may only access your own dependents\' documents');
  }
  if (user.role === 'legal' && !(await employeeHasCase(employeeId))) {
    throw new ForbiddenError('This document is not linked to a case you can access');
  }
  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .select('dependents')
    .eq('id', employeeId)
    .single();
  if (error || !emp) throw new NotFoundError('Employee not found');

  const dependents = (emp.dependents ?? []) as Array<{ id: string; passportStoragePath?: string; passportFileName?: string }>;
  const dep = dependents.find(d => d.id === dependentId);
  if (!dep?.passportStoragePath) throw new NotFoundError('No passport on file for this dependent');

  return storageProvider.signedUrl(
    'employee-docs', dep.passportStoragePath, 3600,
    { download: dep.passportFileName ?? 'passport' },
  );
}

export async function getDocumentSignedUrl(
  docId: string,
  user: { role: string; employeeId?: string | null },
) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  // Authorization: an employee may only fetch documents attached to their own
  // employee record. Staff (admin/hr/operations/finance) may fetch any document.
  // Without this check, any authenticated user could mint a signed URL for any
  // document (incl. SSN/ID scans in the private employee-docs bucket) by UUID.
  assertMayReadDocument(doc, user);
  if (user.role === 'legal') await assertLegalCanAccessDocument(doc);

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  // `download` sets Content-Disposition: attachment so the browser SAVES the
  // file (under its real name) instead of rendering it inline. Without it,
  // TXT/PDF/images open in a tab instead of downloading.
  // 60 min TTL — long enough for users to open an emailed link without
  // re-issuing, short enough that a leaked URL has a bounded window
  // (#19 edge-case audit).
  const url = await storageProvider.signedUrl(bucket, doc.storage_path, 3600, {
    download: doc.name ?? 'document',
  });

  return url ?? null;
}

export async function getDocumentPreviewUrl(
  docId: string,
  user: { role: string; employeeId?: string | null },
) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  assertMayReadDocument(doc, user);
  if (user.role === 'legal') await assertLegalCanAccessDocument(doc);

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  // No `download` option → inline rendering in the browser.
  const url = await storageProvider.signedUrl(bucket, doc.storage_path, 3600);

  return { url: url ?? null, mimeType: doc.type ?? null, name: doc.name ?? 'document' };
}

// Self-hosted document render: downloads from Supabase, converts to HTML server-side.
// Supports: docx→mammoth HTML, xlsx/csv→SheetJS HTML table, txt/md/json→<pre> wrap.
// PDF and images are handled client-side via the signed URL — this returns null for those.
export async function renderDocument(
  docId: string,
  user: { role: string; employeeId?: string | null },
): Promise<{ html: string; kind: 'docx' | 'sheet' | 'text' | 'passthrough'; name: string; inlineUrl?: string }> {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  assertMayReadDocument(doc, user);
  if (user.role === 'legal') await assertLegalCanAccessDocument(doc);

  const name: string = doc.name ?? 'document';
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];

  // PDF and images: return inline signed URL so client renders them natively.
  if (ext === 'pdf' || ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) {
    const urlData = await storageProvider.signedUrl(bucket, doc.storage_path, 3600);
    return { html: '', kind: 'passthrough', name, inlineUrl: urlData ?? undefined };
  }

  // Download the file bytes from Supabase storage.
  const fileData = await storageProvider.download(bucket, doc.storage_path);

  const buffer = fileData;

  // DOCX → HTML via mammoth (preserves headings, bold, lists, tables).
  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.convertToHtml({ buffer });
    return { html: wrapHtml(result.value, name), kind: 'docx', name };
  }

  // XLSX / XLS / CSV → HTML table via SheetJS.
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    let html = '';
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const table = XLSX.utils.sheet_to_html(ws, { id: `sheet-${sheetName}`, editable: false });
      html += `<h3 style="margin:1em 0 0.3em;font-family:sans-serif;font-size:13px;color:#555">${escHtml(sheetName)}</h3>${table}`;
    }
    return { html: wrapHtml(html, name, true), kind: 'sheet', name };
  }

  // Plain text / markdown / JSON / XML → escaped <pre>.
  if (['txt','md','json','xml','html','htm','csv'].includes(ext)) {
    const text = buffer.toString('utf-8');
    const pre = `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;padding:1rem">${escHtml(text)}</pre>`;
    return { html: wrapHtml(pre, name), kind: 'text', name };
  }

  // Unsupported — return empty so client shows download prompt.
  return { html: '', kind: 'passthrough', name };
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function wrapHtml(body: string, _name: string, wide = false): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{margin:1rem ${wide ? '0.5rem' : '2rem'};font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#222}
  table{border-collapse:collapse;width:100%;font-size:12px;font-family:sans-serif}
  td,th{border:1px solid #ccc;padding:4px 8px;white-space:nowrap}
  th{background:#f5f5f5;font-weight:600}
  h1,h2,h3{font-family:sans-serif}
  img{max-width:100%}
</style></head><body>${body}</body></html>`;
}

export async function downloadDocumentBuffer(
  storagePath: string,
  entityType: 'employee' | 'client' | 'invoice',
): Promise<Buffer | null> {
  const bucket = BUCKET_MAP[entityType];
  try {
    return await storageProvider.download(bucket, storagePath);
  } catch {
    // Callers treat null as "no such document"; the provider throws instead of
    // returning an error object, so the envelope check becomes a catch.
    return null;
  }
}

export async function setDocumentLegalReview(
  docId: string,
  flagged: boolean,
  comment: string | null,
  user: { role: string },
) {
  if (user.role === 'legal') {
    const { data: doc, error: findErr } = await supabaseAdmin
      .from('documents')
      .select('entity_type, entity_id')
      .eq('id', docId)
      .single();
    if (findErr || !doc) throw new NotFoundError('Document not found');
    await assertLegalCanAccessDocument(doc);
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .update({ legal_flagged: flagged, legal_flag_comment: comment })
    .eq('id', docId)
    .select()
    .single();
  if (error || !data) throw new NotFoundError('Document not found');
  return data;
}

/**
 * `user` is optional ONLY for internal callers that have already established
 * the right to delete — the supersede path in uploadDocument, which is
 * replacing a document the caller just proved they may write. Every route must
 * pass it: without a viewer this function deleted ANY document by UUID, so
 * `operations` could destroy a client contract or a case document outright.
 */
export async function deleteDocument(
  docId: string,
  user?: { role: string; employeeId?: string | null },
) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  // Deleting is strictly more dangerous than reading, so it reuses the read
  // policy rather than inventing a second, looser one.
  if (user) assertMayReadDocument(doc, user);

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  await storageProvider.remove(bucket, [doc.storage_path]);
  await supabaseAdmin.from('documents').delete().eq('id', docId);
}
