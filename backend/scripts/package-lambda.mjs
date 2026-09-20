// Build the backend Lambda deployment package.
//
//   node scripts/package-lambda.mjs
//
// Produces backend/lambda.zip containing the compiled dist/ plus a
// production-only node_modules. Dependencies are installed into a staging
// directory with `npm ci --omit=dev` rather than copied from the working
// node_modules, which would drag in ~200MB of devDependencies (typescript,
// rolldown, esbuild) that Lambda has no use for.
//
// Not bundled with esbuild on purpose: pdfkit reads .afm font metrics from
// disk at runtime and xlsx/docx pull in files a bundler would leave behind, so
// a bundle would build cleanly and then fail on the first PDF export.
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.lambda-build');
const zipPath = join(root, 'lambda.zip');

// AWS limits. The 250MB unzipped ceiling is the one that actually bites here.
const MAX_ZIP_DIRECT_MB = 50;
const MAX_UNZIPPED_MB = 250;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

const dirSizeMB = dir => {
  let total = 0;
  const walk = d => {
    for (const e of readdirSafe(d)) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dir);
  return total / 1024 / 1024;
};

const readdirSafe = d => {
  try {
    return readdirSync(d, { withFileTypes: true });
  } catch {
    return [];
  }
};

console.log('1/5  clean');
rmSync(stage, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stage, { recursive: true });

console.log('2/5  compile TypeScript');
run('npx', ['tsc'], root);
if (!existsSync(join(root, 'dist', 'lambda.js'))) {
  throw new Error('dist/lambda.js missing - did tsc emit?');
}

console.log('3/5  stage dist/ + manifests');
cpSync(join(root, 'dist'), join(stage, 'dist'), { recursive: true });
for (const f of ['package.json', 'package-lock.json']) {
  cpSync(join(root, f), join(stage, f));
}

console.log('4/5  install production dependencies');
run('npm', ['ci', '--omit=dev', '--ignore-scripts'], stage);
// The manifests are only needed for the install itself; Lambda resolves
// modules from node_modules directly.
rmSync(join(stage, 'package-lock.json'), { force: true });

// Lambda's handler path is relative to the zip root, so re-point "main" and
// leave a note for anyone who unzips this to debug it.
const pkg = JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'));
pkg.main = 'dist/lambda.js';
delete pkg.scripts;
writeFileSync(join(stage, 'package.json'), JSON.stringify(pkg, null, 2));

const unzippedMB = dirSizeMB(stage);
console.log(`     staged: ${unzippedMB.toFixed(1)} MB unzipped`);

console.log('5/5  zip');
if (process.platform === 'win32') {
  run('powershell.exe', [
    '-NoProfile', '-Command',
    `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipPath}' -Force`,
  ], root);
} else {
  run('zip', ['-qr', zipPath, '.'], stage);
}

const zipMB = statSync(zipPath).size / 1024 / 1024;
console.log(`\n  package : ${zipPath}`);
console.log(`  zipped  : ${zipMB.toFixed(1)} MB  (limit ${MAX_ZIP_DIRECT_MB} MB direct upload)`);
console.log(`  unzipped: ${unzippedMB.toFixed(1)} MB  (limit ${MAX_UNZIPPED_MB} MB)`);

const problems = [];
if (zipMB > MAX_ZIP_DIRECT_MB) {
  problems.push(`zip exceeds ${MAX_ZIP_DIRECT_MB}MB - upload via S3 instead of --zip-file`);
}
if (unzippedMB > MAX_UNZIPPED_MB) {
  problems.push(`unzipped exceeds ${MAX_UNZIPPED_MB}MB - Lambda will reject this package`);
}
if (problems.length) {
  console.error('\n  ⚠️  ' + problems.join('\n  ⚠️  '));
  process.exitCode = 1;
} else {
  console.log('\n  ✅ within Lambda limits');
}
