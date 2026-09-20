// S3 implementation.
//
// All eleven Supabase buckets live in ONE S3 bucket, separated by a key
// prefix that encodes visibility:
//
//   private/<supabase-bucket>/<path>   signed URLs only
//   public/<supabase-bucket>/<path>    served by CloudFront at /public/*
//
// The visibility prefix is what makes the CloudFront rule safe. Its path
// pattern is /public/*, which maps one-to-one onto the public prefix, so there
// is no rewriting step that could be got wrong and no way to reach a private
// document through the distribution. Employee documents and profile photos
// sharing a bucket is only acceptable because of that separation.
//
// Reached over the S3 gateway VPC endpoint, so this traffic never leaves the
// VPC and does not consume the NAT gateway.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { isPublicBucket, type StorageProvider } from './types';

function bucketName(): string {
  if (!env.DOCUMENTS_BUCKET) {
    throw new Error('STORAGE_DRIVER=s3 requires DOCUMENTS_BUCKET');
  }
  return env.DOCUMENTS_BUCKET;
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: env.AWS_REGION ?? 'us-east-1' });
  return client;
}

/** Supabase bucket + path -> the single S3 key that holds the object. */
export function s3Key(bucket: string, path: string): string {
  const scope = isPublicBucket(bucket) ? 'public' : 'private';
  // Leading slashes would produce an empty first key segment.
  return `${scope}/${bucket}/${path.replace(/^\/+/, '')}`;
}

export const s3StorageProvider: StorageProvider = {
  name: 's3',

  async upload(bucket, path, body, opts) {
    await s3().send(new PutObjectCommand({
      Bucket: bucketName(),
      Key: s3Key(bucket, path),
      Body: body,
      ContentType: opts.contentType,
      // Supabase's upsert:false fails when the key exists. S3 overwrites by
      // default, so ask for the same behaviour explicitly rather than let a
      // second upload silently replace the first.
      ...(opts.upsert === false ? { IfNoneMatch: '*' } : {}),
    }));
  },

  async download(bucket, path) {
    const res = await s3().send(new GetObjectCommand({
      Bucket: bucketName(),
      Key: s3Key(bucket, path),
    }));
    if (!res.Body) throw new Error(`Empty body for ${bucket}/${path}`);
    return Buffer.from(await res.Body.transformToByteArray());
  },

  async remove(bucket, paths) {
    if (paths.length === 0) return;
    // DeleteObjects takes at most 1000 keys per call.
    for (let i = 0; i < paths.length; i += 1000) {
      await s3().send(new DeleteObjectsCommand({
        Bucket: bucketName(),
        Delete: { Objects: paths.slice(i, i + 1000).map(p => ({ Key: s3Key(bucket, p) })) },
      }));
    }
  },

  async list(bucket, prefix) {
    const fullPrefix = s3Key(bucket, prefix);
    const res = await s3().send(new ListObjectsV2Command({
      Bucket: bucketName(),
      Prefix: fullPrefix,
    }));
    // Callers expect names relative to the prefix, the way Supabase returns
    // them, and then rebuild the full path themselves.
    return (res.Contents ?? []).map(o => ({
      name: (o.Key ?? '').slice(fullPrefix.length).replace(/^\/+/, ''),
    })).filter(o => o.name !== '');
  },

  async signedUrl(bucket, path, expiresInSeconds, opts) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: bucketName(),
        Key: s3Key(bucket, path),
        ...(opts?.download
          ? { ResponseContentDisposition: `attachment; filename="${opts.download.replace(/"/g, '')}"` }
          : {}),
      }),
      { expiresIn: expiresInSeconds },
    );
  },

  publicUrl(bucket, path) {
    if (!isPublicBucket(bucket)) {
      // A signed URL would expire, and callers persist this value - returning
      // one here would write a link that works today and 404s next week.
      throw new Error(`publicUrl called for private bucket "${bucket}"`);
    }
    const base = (env.PUBLIC_ASSET_BASE_URL ?? '').replace(/\/+$/, '');
    if (!base) throw new Error('STORAGE_DRIVER=s3 requires PUBLIC_ASSET_BASE_URL');
    return `${base}/${s3Key(bucket, path)}`;
  },
};
