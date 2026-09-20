// Picks the object store. STORAGE_DRIVER defaults to 'supabase', so Render and
// local development are unaffected and switching back is an env change.
//
// The provider modules are resolved on first USE, not on import. config/env
// validates at import time and calls process.exit(1) when a variable is
// missing, so a static import here would drag that into every test that
// transitively reaches a service - invoices.discount.test.ts mocks
// config/supabase precisely to avoid needing a full environment, and an eager
// import would defeat that by loading config/env behind the mock's back.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { StorageProvider } from './types';

let impl: StorageProvider | null = null;

function resolve(): StorageProvider {
  if (impl) return impl;
  // Read straight from process.env rather than the validated env object: this
  // is a two-value switch with a safe default, and reading it here must not
  // trigger validation of everything else.
  impl = process.env.STORAGE_DRIVER === 's3'
    ? (require('./s3Provider') as typeof import('./s3Provider')).s3StorageProvider
    : (require('./supabaseProvider') as typeof import('./supabaseProvider')).supabaseStorageProvider;
  return impl;
}

export const storageProvider: StorageProvider = {
  get name() { return resolve().name; },
  upload: (...a) => resolve().upload(...a),
  download: (...a) => resolve().download(...a),
  remove: (...a) => resolve().remove(...a),
  list: (...a) => resolve().list(...a),
  signedUrl: (...a) => resolve().signedUrl(...a),
  publicUrl: (...a) => resolve().publicUrl(...a),
};

/** Test seam: forget the resolved driver. */
export function resetStorageProvider(): void {
  impl = null;
}

export { isPublicBucket, PUBLIC_BUCKETS } from './types';
export type { StorageProvider, UploadOptions, SignedUrlOptions } from './types';
