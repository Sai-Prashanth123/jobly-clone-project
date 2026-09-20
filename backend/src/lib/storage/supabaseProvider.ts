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

  publicUrl(bucket, path) {
    return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
};
