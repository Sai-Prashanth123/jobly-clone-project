#!/usr/bin/env node
// Deploy the built SPA to S3 + CloudFront.
//
// The one rule that matters here: DO NOT pass --delete on the assets sync.
//
// index.html names a hashed chunk per lazy route, and those hashes change
// every build. Deleting the previous build's chunks strands every user who
// already had the app open (or a cached index.html) — their next navigation
// requests a filename that no longer exists and the route dies with "Failed
// to fetch dynamically imported module". That is exactly what staff hit on
// Expiring Documents after a deploy.
//
// Keeping old chunks is safe: filenames are content-hashed, so they never
// collide and an old file is only ever read by a client that genuinely wants
// that build. They cost a few MB. Prune them with an S3 lifecycle rule on
// assets/ (expire after ~30 days) rather than at deploy time.
//
// Cache headers are the other half:
//   assets/*    immutable, 1 year  — safe because the name changes on change
//   index.html  no-cache           — must be re-fetched to learn new hashes
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const AWS = process.env.AWS_CLI ?? 'D:/awscli/Amazon/AWSCLIV2/aws.exe';
const BUCKET = process.env.SITE_BUCKET ?? 'joblyportal-site-146183084568';
const DIST_ID = process.env.CF_DIST_ID ?? 'E30NGD5W5GA235';
const PROFILE = process.env.AWS_PROFILE ?? 'jobly';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}

// `capture` only for the one step whose output we need (the invalidation id).
// Everything else streams straight through: piping the sync steps buffered
// megabytes of "Completed 7.7 MiB/24.6 MiB..." progress, and on failure that
// buffer is what got dumped — burying the one line that said what went wrong
// (an expired SSO token) under thousands of progress updates.
const run = (args, label, capture = false) => {
  console.log(`\n▸ ${label}`);
  try {
    return execFileSync(AWS, args, {
      encoding: 'utf8',
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
  } catch (err) {
    console.error(`\n✗ ${label} failed (exit ${err.status}).`);
    console.error('  If this mentions SSO or credentials, re-run:');
    console.error('  aws sso login --profile jobly');
    process.exit(err.status ?? 1);
  }
};

// 1. Hashed assets first, so every chunk index.html can name already exists
//    by the time index.html starts pointing at them. NOTE: no --delete.
//
//    `cp --recursive`, not `sync`, on purpose: sync skips files whose size and
//    timestamp match, which leaves an unchanged chunk's LastModified frozen at
//    whenever it first shipped. Any lifecycle rule that prunes old objects
//    would then delete chunks the CURRENT build still depends on. Re-uploading
//    every file each deploy keeps LastModified honest, so "old" really does
//    mean "no recent build referenced it". It costs a few MB per deploy.
run(
  ['s3', 'cp', 'dist/', `s3://${BUCKET}/`, '--recursive', '--profile', PROFILE, '--region', REGION,
    '--exclude', 'index.html',
    '--cache-control', 'public,max-age=31536000,immutable'],
  'Uploading hashed assets (previous builds kept on purpose)',
);

// 2. index.html last, and never cached.
run(
  ['s3', 'cp', 'dist/index.html', `s3://${BUCKET}/index.html`, '--profile', PROFILE, '--region', REGION,
    '--cache-control', 'no-cache,no-store,must-revalidate',
    '--content-type', 'text/html'],
  'Uploading index.html (no-cache)',
);

// 3. Only index.html needs invalidating — the assets are immutable and
//    uniquely named, so they are never stale.
const out = run(
  ['cloudfront', 'create-invalidation', '--distribution-id', DIST_ID,
    '--paths', '/', '/index.html', '--profile', PROFILE,
    '--query', 'Invalidation.Id', '--output', 'text'],
  'Invalidating index.html',
  true,
);

console.log(`\n✅ deployed — invalidation ${out.trim()}`);
