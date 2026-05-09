import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const ROOT = new URL('../public/assets/img/', import.meta.url).pathname.replace(/^\//, '');
const MIN_BYTES = 200 * 1024;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const files = await walk(ROOT);
let saved = 0;
let processed = 0;

for (const file of files) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
  const s = await stat(file);
  if (s.size < MIN_BYTES) continue;

  const before = s.size;
  const buf = await sharp(file)
    .toBuffer({ resolveWithObject: false });

  const optimized = ext === '.png'
    ? await sharp(buf).png({ quality: 75, compressionLevel: 9, palette: true }).toBuffer()
    : await sharp(buf).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

  if (optimized.length < before * 0.95) {
    const { writeFile, rename, unlink } = await import('node:fs/promises');
    const tmp = `${file}.tmp.${process.pid}`;
    let ok = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        await writeFile(tmp, optimized);
        await rename(tmp, file);
        ok = true;
      } catch (e) {
        lastErr = e;
        try { await unlink(tmp); } catch {}
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (ok) {
      saved += before - optimized.length;
      processed += 1;
      console.log(`OK  ${basename(file).padEnd(36)} ${fmt(before).padStart(10)} -> ${fmt(optimized.length).padStart(10)}  (saved ${fmt(before - optimized.length)})`);
    } else {
      console.log(`FAIL ${basename(file).padEnd(35)} (${lastErr?.code ?? 'err'}) — skipped`);
    }
  } else {
    console.log(`SKIP ${basename(file).padEnd(35)} (already small)`);
  }
}

console.log(`\nDone. Compressed ${processed} files. Total saved: ${fmt(saved)} (${(saved/1024/1024).toFixed(2)} MB).`);
