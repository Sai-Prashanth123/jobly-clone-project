import { supabaseAdmin } from '../config/supabase';
import { NotFoundError } from '../lib/errors';

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

  const { data: urlData } = await supabaseAdmin
    .storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);

  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      name: nameOverride || file.originalname,
      type: docTypeOverride || file.mimetype,
      storage_path: storagePath,
      storage_url: urlData?.signedUrl,
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

export async function getDocumentSignedUrl(docId: string) {
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !doc) throw new NotFoundError('Document not found');

  const bucket = BUCKET_MAP[doc.entity_type as keyof typeof BUCKET_MAP];
  const { data } = await supabaseAdmin
    .storage
    .from(bucket)
    .createSignedUrl(doc.storage_path, 900); // 15 min

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
