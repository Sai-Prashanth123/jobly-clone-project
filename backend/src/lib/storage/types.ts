// The storage operations the application actually performs, taken from all 50
// supabaseAdmin.storage references in src/.
//
// `bucket` keeps its Supabase name under both drivers. On S3 those names become
// key prefixes inside one bucket rather than eleven separate buckets, so the
// call sites - and every storage_path already stored in the database - carry
// over unchanged.

export interface UploadOptions {
  contentType: string;
  /** false means "fail if the key already exists", matching Supabase. */
  upsert?: boolean;
}

export interface SignedUrlOptions {
  /** Forces a download and names the file, rather than rendering inline. */
  download?: string;
  /**
   * Serve the object as this type regardless of what is stored against it.
   *
   * Used to hand back application/octet-stream for anything a browser would
   * execute, so an uploaded .html or .svg downloads instead of running.
   */
  forceContentType?: string;
}

export interface StorageObject {
  name: string;
}

export interface StorageProvider {
  readonly name: 'supabase' | 's3';

  upload(bucket: string, path: string, body: Buffer, opts: UploadOptions): Promise<void>;

  download(bucket: string, path: string): Promise<Buffer>;

  remove(bucket: string, paths: string[]): Promise<void>;

  /** Objects directly under `prefix`. Used to clear old profile photos. */
  list(bucket: string, prefix: string): Promise<StorageObject[]>;

  /** Time-limited URL for a private object. */
  signedUrl(
    bucket: string, path: string, expiresInSeconds: number, opts?: SignedUrlOptions,
  ): Promise<string>;

  /**
   * Time-limited URL the BROWSER may PUT a file to, bypassing this server.
   *
   * Uploads used to travel through Lambda, where API Gateway base64-encodes
   * the body and Lambda caps a request at 6 MB — a real ceiling of ~4.5 MiB,
   * while the UI advertised 20 MB. Sending the bytes straight to storage
   * removes that limit entirely.
   *
   * `contentType` is signed into the URL, so the client cannot store a file
   * under a type it chose; see lib/storage/contentType.ts for why that matters.
   */
  signedUploadUrl(
    bucket: string, path: string, expiresInSeconds: number, opts: { contentType: string },
  ): Promise<string>;

  /**
   * Size and type of a stored object, or null when there is none.
   *
   * Two callers: confirming a presigned upload actually arrived and how big it
   * really is (the client cannot be believed about either), and refusing to
   * pull an enormous file into memory to render a preview.
   */
  stat(bucket: string, path: string): Promise<{ size: number; contentType?: string } | null>;

  /**
   * Permanent, unauthenticated URL. Only valid for the buckets listed in
   * PUBLIC_BUCKETS - the value gets persisted (employees.profile_photo_url),
   * so it must not expire.
   */
  publicUrl(bucket: string, path: string): string;
}

/**
 * Buckets whose contents are served without authentication. Everything else is
 * private and reachable only through a signed URL.
 *
 * This list is what keeps employee documents out of the public CloudFront
 * path, so adding to it is a security decision, not a convenience one.
 */
export const PUBLIC_BUCKETS = new Set(['employee-photos', 'document-templates']);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}
