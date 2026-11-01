// Copy every object from Supabase Storage into the S3 documents bucket.
//
// Keys are rewritten to <scope>/<supabase-bucket>/<path>, where scope is
// public or private. The path segment is unchanged, so every storage_path
// already recorded in the database keeps working - nothing in RDS has to be
// rewritten except the two persisted public URLs, handled separately.
//
// Verified by size AND content hash per object: S3's ETag is compared against
// the MD5 of what was sent, because a truncated or byte-corrupted copy is the
// failure mode that would otherwise go unnoticed until someone opened a
// passport scan and found half an image. (This claim used to be untrue — the
// md5 was recorded in the manifest and never checked against anything.)
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const SUPABASE_URL = 'https://ufkrfrmqangydrjbzljo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'joblyportal-documents-146183084568';
const SP = 'C:/Users/saip0/AppData/Local/Temp/claude/D--jobly/af64cd4f-d82a-4cc7-a747-b46007c1e485/scratchpad';

const PUBLIC_BUCKETS = new Set(['employee-photos', 'document-templates']);

const s3 = new S3Client({ region: 'us-east-1' });
const md5 = b => createHash('md5').update(b).digest('hex');

const PAGE = 1000;

/** List every object in a Supabase bucket, recursing into folders. */
async function listAll(bucket, prefix = '') {
  const out = [];
  // Paged, rather than one fixed request. A single { limit: 1000, offset: 0 }
  // silently truncated any folder holding more than 1000 entries, copied the
  // first page, and reported the bucket as done.
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: HTTP ${res.status}`);
    const page = await res.json();
    for (const item of page) {
      const path = prefix ? `${prefix}${item.name}` : item.name;
      // Supabase reports folders as entries with a null id.
      if (item.id === null) out.push(...await listAll(bucket, `${path}/`));
      else out.push({ path, size: item.metadata?.size ?? null, contentType: item.metadata?.mimetype });
    }
    if (page.length < PAGE) break;
  }
  return out;
}

async function download(bucket, path) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const buckets = JSON.parse(process.argv[2] ?? '[]');
const results = [];
let copied = 0, failed = 0, bytes = 0;

for (const bucket of buckets) {
  const scope = PUBLIC_BUCKETS.has(bucket) ? 'public' : 'private';
  let objects;
  try {
    objects = await listAll(bucket);
  } catch (e) {
    console.log(`  ✗ ${bucket}: ${e.message}`);
    failed++;
    continue;
  }

  let ok = 0, bad = 0;
  for (const obj of objects) {
    const key = `${scope}/${bucket}/${obj.path}`;
    try {
      const body = await download(bucket, obj.path);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: body,
        ContentType: obj.contentType || 'application/octet-stream',
      }));
      // Read back the stored length: PutObject succeeding does not prove the
      // whole body arrived.
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      if (head.ContentLength !== body.length) throw new Error(`size ${head.ContentLength} != ${body.length}`);
      // The length matching proves nothing about the bytes. For a single-part
      // PUT the ETag IS the MD5 of the object, so comparing it catches
      // corruption that a length check cannot. A multipart upload's ETag is
      // "<hash>-<parts>" and is not an MD5 at all -- skip those rather than
      // report a mismatch that is not one.
      const digest = md5(body);
      const etag = String(head.ETag ?? '').replace(/"/g, '');
      if (etag && !etag.includes('-') && etag !== digest) {
        throw new Error(`content ${etag} != ${digest}`);
      }
      results.push({ bucket, path: obj.path, key, size: body.length, md5: digest });
      ok++; copied++; bytes += body.length;
    } catch (e) {
      console.log(`  ✗ ${bucket}/${obj.path}: ${e.message}`);
      bad++; failed++;
    }
  }
  console.log(`  ${scope.padEnd(7)} ${bucket.padEnd(22)} ${String(ok).padStart(3)} copied${bad ? `, ${bad} FAILED` : ''}`);
}

writeFileSync(`${SP}/storage-manifest.json`, JSON.stringify(results));
console.log(`\n  total: ${copied} objects, ${(bytes / 1024 / 1024).toFixed(1)} MB, ${failed} failed`);
