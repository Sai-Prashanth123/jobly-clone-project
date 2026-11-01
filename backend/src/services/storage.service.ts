import { uniqueObjectPath, assertPathBelongsToEntity } from '../lib/storage/objectPath';
import { supabaseAdmin } from '../config/supabase';
import {
  NotFoundError, ForbiddenError, ValidationError, ConflictError, PayloadTooLargeError,
} from '../lib/errors';
import { contentTypeForFileName } from '../lib/storage/contentType';
import {
  MAX_UPLOAD_BYTES, UPLOAD_URL_TTL_SECONDS, maxUploadLabel, isInlineSafe, RENDER_MAX_BYTES,
} from '../lib/storage/uploadLimits';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
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
 * - `operations` / `finance` — everything, including employee documents.
 *                  Reviewing an employee's documents is ordinary work for an
 *                  operations manager. These two were briefly refused employee
 *                  documents on the reasoning that `redactEmployee` blinds them
 *                  to `ssn` and `bank_*` on the JSON path, so a signed URL for
 *                  an SSN card was inconsistent. Nobody had asked for that, and
 *                  it broke document preview outright for them — /render and
 *                  /url both 403'd, so the dialog said "Could not load this
 *                  document" with Download greyed out, reading as a broken file
 *                  rather than a permission decision. If specific TYPES should
 *                  be withheld, scope it to the type in lib/documentAccess.ts
 *                  rather than refusing the whole entity_type.
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

/**
 * The bucket an entity's documents live in.
 *
 * Exported so a caller that needs readSizedObject's budget-aware read — rather
 * than downloadDocumentBuffer's fixed RENDER_MAX_BYTES and silent null — can
 * name the bucket without duplicating this map.
 */
export function documentBucketFor(entityType: string): string {
  return BUCKET_MAP[entityType] ?? BUCKET_MAP.employee;
}

/**
 * How big an object is, without reading it.
 *
 * For deciding what fits in an email before pulling anything into memory:
 * null when it cannot be determined, which the caller must treat as "cannot
 * attach" rather than as zero bytes.
 */
export async function statObjectSize(bucket: string, storagePath: string): Promise<number | null> {
  try {
    const info = await storageProvider.stat(bucket, storagePath);
    return info?.size ?? null;
  } catch (err) {
    console.error('[storage] could not stat', bucket, storagePath, err);
    return null;
  }
}

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

/**
 * Write the `documents` row for a file that is already in storage.
 *
 * Extracted from uploadDocument so the presigned-upload path, where the
 * browser PUTs straight to S3 and the server never sees the bytes, records a
 * document exactly the same way a multipart upload does — including the
 * replacement semantics below, which are easy to get subtly different in a
 * second implementation.
 */
async function insertDocumentRow(a: {
  entityType: 'employee' | 'client' | 'invoice' | 'case';
  entityId: string;
  storagePath: string;
  name: string;
  type: string;
  uploadedBy: string;
  expiryDate?: string | null;
  category?: string | null;
  replaceExisting?: boolean;
}) {
  // Don't generate/store a signed URL here: it's an extra storage round-trip on
  // every upload (slows uploads) and the value expires in ~1h anyway. Downloads
  // always mint a fresh, download-forcing URL via getDocumentSignedUrl below
  // (GET /documents/:id/url).
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .insert({
      entity_type: a.entityType,
      entity_id: a.entityId,
      name: a.name,
      type: a.type,
      storage_path: a.storagePath,
      storage_url: null,
      uploaded_by: a.uploadedBy,
      expiry_date: a.expiryDate || null,
      category: a.category || null,
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
  if (a.replaceExisting && doc?.id) {
    try {
      const { data: superseded } = await supabaseAdmin
        .from('documents')
        .select('id')
        .eq('entity_type', a.entityType)
        .eq('entity_id', a.entityId)
        .eq('type', a.type)
        .neq('id', doc.id);
      for (const old of superseded ?? []) {
        await deleteDocument(old.id);
      }
    } catch (err) {
      console.error('[storage] failed to remove superseded documents for', a.entityId, a.type, err);
    }
  }

  return doc;
}

/**
 * Hand the browser a URL it can PUT a file straight to.
 *
 * The bytes never reach this server. Uploads used to travel through Lambda,
 * where API Gateway base64-encodes the body and Lambda caps a request at 6 MB
 * — a real ceiling of about 4.5 MiB, while every screen promised 20 MB. A
 * 7.9 MB passport was rejected by API Gateway before Express ran, which is why
 * raising the multer limit could never have fixed it.
 *
 * THE SERVER CHOOSES THE KEY. It is the same uniqueObjectPath call the
 * multipart path uses, so the key format is unchanged, every existing
 * storage_path keeps working, and — crucially — a client cannot name a
 * location of its own choosing. registerUploadedDocument re-checks that the
 * path it is later given sits under this entity's prefix.
 */
export async function createDocumentUploadTarget(
  entityType: 'employee' | 'client' | 'invoice' | 'case',
  entityId: string,
  fileName: string,
): Promise<{
  uploadUrl: string;
  storagePath: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
}> {
  const bucket = BUCKET_MAP[entityType];
  const storagePath = uniqueObjectPath(entityId, fileName);

  // Signed into the URL, so the browser cannot store a file under a type it
  // picked — an uploaded .html is stored as application/octet-stream and can
  // never be served back as something a browser will execute.
  const contentType = contentTypeForFileName(fileName);

  const uploadUrl = await storageProvider.signedUploadUrl(
    bucket, storagePath, UPLOAD_URL_TTL_SECONDS, { contentType },
  );

  // maxBytes travels back so the client's error copy is never a retyped number.
  return {
    uploadUrl, storagePath, contentType,
    maxBytes: MAX_UPLOAD_BYTES,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

/**
 * Record a file the browser has already put in storage.
 *
 * Everything the client says about the upload is checked, because by this
 * point the client is the only one who has seen it:
 *
 *   the path   must sit under this entity's prefix, or a user could attach
 *              somebody else's document to their own record
 *   existence  a path can be claimed without anything having been uploaded
 *   the size   is read from storage, never taken from the request
 *
 * An oversize object is deleted rather than left orphaned — otherwise the size
 * limit is merely advisory and the bucket accumulates files nothing points at.
 */
export async function registerUploadedDocument(a: {
  entityType: 'employee' | 'client' | 'invoice' | 'case';
  entityId: string;
  storagePath: string;
  uploadedBy: string;
  fileName: string;
  nameOverride?: string;
  docTypeOverride?: string;
  expiryDate?: string | null;
  category?: string | null;
  replaceExisting?: boolean;
}) {
  const bucket = BUCKET_MAP[a.entityType];

  // 1. The path must be one we issued for THIS record.
  try {
    assertPathBelongsToEntity(a.entityId, a.storagePath);
  } catch {
    throw new ForbiddenError('That upload does not belong to this record.');
  }

  // 2. Never let two rows point at one object: deleting either would destroy
  //    the file the other still references.
  const { data: already, error: dupErr } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('storage_path', a.storagePath)
    .maybeSingle();
  if (dupErr) {
    console.error('[storage] could not check for an existing document row', a.storagePath, dupErr);
    throw dupErr;
  }
  if (already) throw new ConflictError('That upload has already been saved.');

  // 3. Confirm it actually arrived, and how big it really is.
  const info = await storageProvider.stat(bucket, a.storagePath);
  if (!info) {
    throw new ValidationError('That upload did not finish. Please try again.');
  }
  if (info.size === 0) {
    await storageProvider.remove(bucket, [a.storagePath]).catch(() => {});
    throw new ValidationError('That file appears to be empty. Please check it and try again.');
  }
  if (info.size > MAX_UPLOAD_BYTES) {
    await storageProvider.remove(bucket, [a.storagePath]).catch(err =>
      console.error('[storage] could not remove an oversize upload', a.storagePath, err));
    throw new PayloadTooLargeError(`That file is larger than ${maxUploadLabel()}.`);
  }

  return insertDocumentRow({
    entityType: a.entityType,
    entityId: a.entityId,
    storagePath: a.storagePath,
    name: a.nameOverride || a.fileName,
    type: a.docTypeOverride || contentTypeForFileName(a.fileName),
    uploadedBy: a.uploadedBy,
    expiryDate: a.expiryDate,
    category: a.category,
    replaceExisting: a.replaceExisting,
  });
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
  const storagePath = uniqueObjectPath(entityId, file.originalname);

  await storageProvider.upload(bucket, storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  return insertDocumentRow({
    entityType,
    entityId,
    storagePath,
    name: nameOverride || file.originalname,
    type: docTypeOverride || file.mimetype,
    uploadedBy,
    expiryDate,
    category,
    replaceExisting,
  });
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

  const storagePath = uniqueObjectPath(`${employeeId}/dependents/${dependentId}`, file.originalname);
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
  const name: string = doc.name ?? 'document';

  // Inline ONLY for types a browser can safely render. Now that every file
  // type may be uploaded, an .html or .svg handed back without a disposition
  // would execute its script when opened — not against the portal's own
  // origin, but still as a credible page on an amazonaws.com URL. Everything
  // outside the safe list downloads instead.
  const url = await storageProvider.signedUrl(
    bucket, doc.storage_path, 3600,
    isInlineSafe(name) ? undefined : { download: name, forceContentType: 'application/octet-stream' },
  );

  return { url: url ?? null, mimeType: doc.type ?? null, name };
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

  // PDF and images: return an inline signed URL so the client renders them
  // natively. Driven by the shared safe list rather than a literal, which is
  // how SVG left this branch — it is an image to a person and a script host to
  // a browser, so it now falls through to the "Preview not available" path.
  if (isInlineSafe(name)) {
    const urlData = await storageProvider.signedUrl(bucket, doc.storage_path, 3600);
    return { html: '', kind: 'passthrough', name, inlineUrl: urlData ?? undefined };
  }

  // Anything converted below is pulled whole into this process and returned
  // inside a JSON response, and a Lambda response has the same 6 MB limit a
  // request does. With uploads now allowed up to 100 MB, a large spreadsheet
  // would exhaust memory or produce a response API Gateway refuses — a 500
  // where the dialog should simply offer a download.
  const info = await storageProvider.stat(bucket, doc.storage_path);
  if ((info?.size ?? 0) > RENDER_MAX_BYTES) {
    return { html: '', kind: 'passthrough', name };
  }

  // Download the file bytes from Supabase storage.
  const fileData = await storageProvider.download(bucket, doc.storage_path);

  const buffer = fileData;

  // Sniff the container instead of trusting the file extension.
  //
  // mammoth reads ONLY .docx — Office Open XML, which is a zip archive. The
  // legacy .doc format is an entirely different thing (an OLE2 compound file),
  // and handing one to mammoth throws. Both extensions were being routed to it,
  // so every .doc failed preview with "Could not load this document" while
  // downloading worked, because downloading just streams the bytes back.
  // Reported against "H-4 Beneficiary Questionnaire_Gouthami.doc".
  //
  // Extensions also lie in both directions — a .docx saved as .doc, or a .doc
  // that is really RTF — so the magic bytes decide, not the name.
  // Bounds match what each check actually reads (bytes 0-1 and 0-3), so a file
  // that is exactly header-length is still classified rather than skipped.
  const isZip = buffer.length >= 2
    && buffer[0] === 0x50 && buffer[1] === 0x4b;                       // "PK"  → OOXML
  const isOle2 = buffer.length >= 4
    && buffer[0] === 0xd0 && buffer[1] === 0xcf
    && buffer[2] === 0x11 && buffer[3] === 0xe0;                       // legacy Office

  // Word → HTML via mammoth (preserves headings, bold, lists, tables).
  if (ext === 'docx' || ext === 'doc') {
    if (isZip) {
      try {
        const result = await mammoth.convertToHtml({ buffer });
        return { html: wrapHtml(result.value, name), kind: 'docx', name };
      } catch (err) {
        // Corrupt or unexpected contents: fall through to the download prompt
        // rather than failing the whole dialog.
        console.warn('[renderDocument] mammoth failed for', name, err);
        return { html: '', kind: 'passthrough', name };
      }
    }
    // Legacy .doc (OLE2). mammoth cannot read these, but word-extractor can
    // pull the text out of the binary format. It is text only — images are
    // dropped and table layout is flattened — but for the questionnaires and
    // letters that actually arrive as .doc, the content is the point, and
    // reading it beats a download prompt.
    if (isOle2) {
      try {
        const extracted = await new WordExtractor().extract(buffer);
        const body = extracted.getBody();
        if (body && body.trim()) {
          return { html: wrapHtml(legacyDocHtml(body), name), kind: 'docx', name };
        }
      } catch (err) {
        console.warn('[renderDocument] legacy .doc extraction failed for', name, err);
      }
    }
    // Not OOXML, not readable OLE2 — fall back to the download prompt.
    return { html: '', kind: 'passthrough', name };
  }

  // Excel → HTML table via SheetJS. SheetJS DOES read legacy .xls, so OLE2 is
  // fine here — unlike Word above.
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      let html = '';
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const table = XLSX.utils.sheet_to_html(ws, { id: `sheet-${sheetName}`, editable: false });
        html += `<h3 style="margin:1em 0 0.3em;font-family:sans-serif;font-size:13px;color:#555">${escHtml(sheetName)}</h3>${table}`;
      }
      return { html: wrapHtml(html, name, true), kind: 'sheet', name };
    } catch (err) {
      console.warn('[renderDocument] sheet parse failed for', name, err);
      return { html: '', kind: 'passthrough', name };
    }
  }

  // A file whose extension is unknown but whose bytes are OOXML — e.g. a .docx
  // renamed to something else — is still worth trying.
  if (isZip && !isOle2) {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      if (result.value.trim()) return { html: wrapHtml(result.value, name), kind: 'docx', name };
    } catch { /* not a Word file; fall through */ }
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

/**
 * Render extracted legacy-.doc text as readable HTML.
 *
 * word-extractor returns plain text with the original line breaks, so the
 * structure of a form or questionnaire survives even though the formatting
 * does not. Blank-line runs become paragraph breaks; single newlines are kept
 * as line breaks, which matters for the numbered questions these documents are
 * mostly made of.
 */
function legacyDocHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  // A quiet note that this is a converted legacy file, so nobody mistakes the
  // missing formatting for a damaged document.
  return `<div style="border-left:3px solid #d0d7e8;background:#f7f9fc;padding:8px 12px;margin:0 0 20px;font-family:sans-serif;font-size:12px;color:#5a6a85">
Converted from a legacy Word (.doc) file &mdash; text only. Images and exact layout are not preserved. Download the file to see the original.
</div>
${paragraphs}`;
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

/**
 * Read an object from a named bucket, refusing anything over `maxBytes`.
 *
 * downloadDocumentBuffer cannot serve this: it maps an entity type to the
 * documents bucket, and timesheet proofs live in their own bucket. It also
 * applies RENDER_MAX_BYTES, which is the wrong limit for an email attachment
 * and would silently drop a proof the caller wanted to know about.
 *
 * The size is checked BEFORE the read, so an oversize proof costs a HEAD
 * rather than pulling 100 MB into the Lambda to then discard it. Returns the
 * reason instead of null so the caller can tell the client what is missing.
 */
export async function readSizedObject(
  bucket: string,
  storagePath: string,
  maxBytes: number,
): Promise<{ buffer: Buffer } | { tooLarge: true; size: number } | null> {
  try {
    const info = await storageProvider.stat(bucket, storagePath);
    if (!info) return null;
    if (info.size > maxBytes) return { tooLarge: true, size: info.size };
    return { buffer: await storageProvider.download(bucket, storagePath) };
  } catch (err) {
    console.error('[storage] could not read', bucket, storagePath, err);
    return null;
  }
}

export async function downloadDocumentBuffer(
  storagePath: string,
  entityType: 'employee' | 'client' | 'invoice',
): Promise<Buffer | null> {
  const bucket = BUCKET_MAP[entityType];
  try {
    // Pulled whole into this process, by callers that then attach it to an
    // email or embed it in a PDF. With uploads now up to 100 MB, a large file
    // would exhaust the Lambda's memory; null is the answer those callers
    // already handle for "no such document".
    const info = await storageProvider.stat(bucket, storagePath);
    if ((info?.size ?? 0) > RENDER_MAX_BYTES) {
      console.warn('[storage] skipping an oversize buffer read for', storagePath, info?.size);
      return null;
    }
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
