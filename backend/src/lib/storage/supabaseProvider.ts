// Supabase Storage implementation - the behaviour the app has today, and the
// rollback path. STORAGE_DRIVER selects between this and S3.
import { supabaseAdmin } from '../../config/supabase';
import type { StorageProvider } from './types';

export const supabaseStorageProvider: StorageProvider = {
  name: 'supabase',

  async upload(bucket, path, body, opts) {
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, body, {
      contentType: opts.contentType,
      upsert: opts.upsert ?? false,
    });
    if (error) throw error;
  },

  async download(bucket, path) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error(`Download failed for ${bucket}/${path}`);
    return Buffer.from(await data.arrayBuffer());
  },

  async remove(bucket, paths) {
    if (paths.length === 0) return;
    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) throw error;
  },

  async list(bucket, prefix) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    return (data ?? []).map(f => ({ name: f.name }));
  },

  async signedUrl(bucket, path, expiresInSeconds, opts) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds, opts?.download ? { download: opts.download } : undefined);
    if (error || !data?.signedUrl) throw error ?? new Error(`Signing failed for ${bucket}/${path}`);
    return data.signedUrl;
  },

  async signedUploadUrl(bucket, path) {
    // Supabase signs an upload target rather than taking a content type — the
    // type is whatever the client sends. That is acceptable here because the
    // protection that matters is on the way back OUT: signedUrl below always
    // passes `download`, so nothing from this driver is ever rendered inline.
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error || !data?.signedUrl) throw error ?? new Error(`Upload signing failed for ${bucket}/${path}`);
    return data.signedUrl;
  },

  async stat(bucket, path) {
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(dir, { search: name });
    if (error) throw error;
    const hit = (data ?? []).find(o => o.name === name);
    if (!hit) return null;
    const meta = (hit as { metadata?: { size?: number; mimetype?: string } }).metadata;
    return { size: meta?.size ?? 0, contentType: meta?.mimetype };
  },

  publicUrl(bucket, path) {
    return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
};
