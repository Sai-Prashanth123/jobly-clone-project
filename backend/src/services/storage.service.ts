import { supabaseAdmin } from '../config/supabase';
import { NotFoundError, ForbiddenError } from '../lib/errors';

const BUCKET_MAP: Record<string, string> = {
  employee: 'employee-docs',
  client: 'client-docs',
  invoice: 'invoices',
};

export async function uploadDocument(
  entityType: 'employee' | 'client' | 'invoice',
  entityId: string,
  file: Express.Multer.File,
  uploadedBy: string,
  nameOverride?: string,
  docTypeOverride?: string,
) {
  const bucket = BUCKET_MAP[entityType];
  const storagePath = `${entityId}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw uploadError;

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
    })
    .select()
    .single();

  if (error) throw error;
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

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  // Public bucket → permanent, unauthenticated URL (no expiry).
  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  const { error: updErr } = await supabaseAdmin
    .from('employees')
    .update({ profile_photo_url: publicUrl })
    .eq('id', employeeId);
  if (updErr) throw updErr;

  return publicUrl;
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
  if (user.role === 'employee') {
    const ownsIt = doc.entity_type === 'employee' && doc.entity_id === user.employeeId;
    if (!ownsIt) throw new ForbiddenError('You may only access your own documents');
  }

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  const { data } = await supabaseAdmin
    .storage
    .from(bucket)
    // `download` sets Content-Disposition: attachment so the browser SAVES the
    // file (under its real name) instead of rendering it inline. Without it,
    // TXT/PDF/images open in a tab instead of downloading.
    .createSignedUrl(doc.storage_path, 900, { download: doc.name ?? 'document' }); // 15 min

  return data?.signedUrl ?? null;
}

export async function deleteDocument(docId: string) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  await supabaseAdmin.storage.from(bucket).remove([doc.storage_path]);
  await supabaseAdmin.from('documents').delete().eq('id', docId);
}
