// Convert heavy PNG/JPEG assets to WebP and rewrite the references.
//
// The landing page was shipping 5.3 MB of images, 4.1 MB of it the three hero
// banner slides alone — photographic content saved as PNG, which is the worst
// possible format for it. PNG is lossless and has no business encoding a photo
// of an office; WebP at q80 is visually indistinguishable here and roughly a
// tenth of the size.
//
// Run with:  node scripts/optimize-images.mjs [--dry]
//
// Safe to re-run: it skips anything already converted, never deletes an
// original (the PNG stays as a fallback and for anything referencing it that
// this script did not find), and tells you exactly what it changed.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import sharp from 'sharp';

const DRY = process.argv.includes('--dry');
const IMG_ROOT = 'public/assets/img';
const CODE_ROOTS = ['src'];
const MIN_BYTES = 80 * 1024;   // below this the saving is not worth a new file
const QUALITY = 80;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ path: p, size: st.size });
  }
  return out;
}

function codeFiles() {
  const out = [];
  for (const root of CODE_ROOTS) {
    if (!existsSync(root)) continue;
    for (const f of walk(root)) {
      if (/\.(tsx?|jsx?|css)$/.test(f.path)) out.push(f.path);
    }
  }
  return out;
}

const candidates = walk(IMG_ROOT)
  .filter(f => /\.(png|jpe?g)$/i.test(f.path) && f.size >= MIN_BYTES)
  .sort((a, b) => b.size - a.size);

console.log(`${candidates.length} images over ${Math.round(MIN_BYTES / 1024)} KB\n`);

const converted = [];
let before = 0, after = 0;

for (const { path: p, size } of candidates) {
  const webp = p.replace(/\.(png|jpe?g)$/i, '.webp');
  before += size;

  if (existsSync(webp)) {
    after += statSync(webp).size;
    continue;
  }
  if (DRY) {
    console.log(`  would convert  ${relative(IMG_ROOT, p)}  (${(size / 1048576).toFixed(2)} MB)`);
    continue;
  }

  await sharp(p).webp({ quality: QUALITY }).toFile(webp);
  const newSize = statSync(webp).size;

  // WebP is not universally smaller. Flat graphics and overlays with large
  // transparent regions compress better as PNG — three of these came out up to
  // twice the size on the first run. Keep whichever is actually smaller, or the
  // "optimisation" makes the page heavier.
  if (newSize >= size) {
    unlinkSync(webp);
    after += size;
    console.log(
      `  kept PNG  ${relative(IMG_ROOT, p)}  (webp was ${(newSize / 1048576).toFixed(2)} MB vs ${(size / 1048576).toFixed(2)} MB)`,
    );
    continue;
  }

  after += newSize;
  converted.push({ from: p, to: webp, size, newSize });
  const pct = Math.round((1 - newSize / size) * 100);
  console.log(
    `  ${(size / 1048576).toFixed(2)} MB -> ${(newSize / 1048576).toFixed(2)} MB  (-${pct}%)  ${relative(IMG_ROOT, p)}`,
  );
}

if (DRY) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

// Rewrite references. Paths in code are web paths (/assets/img/...), so map
// from the filesystem path to the served one.
const toWebPath = p => '/' + p.replace(/\\/g, '/').replace(/^public\//, '');
let rewritten = 0;
const files = codeFiles();
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  const original = s;
  for (const c of converted) {
    const fromWeb = toWebPath(c.from);
    const toWeb = toWebPath(c.to);
    if (s.includes(fromWeb)) s = s.split(fromWeb).join(toWeb);
  }
  if (s !== original) { writeFileSync(f, s); rewritten++; }
}

console.log(`\nconverted : ${converted.length} images`);
console.log(`payload   : ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
console.log(`references rewritten in ${rewritten} files`);
console.log('\nOriginals kept on disk as a fallback — delete them only once you have');
console.log('confirmed nothing else (including the legacy template CSS) still points at them.');
