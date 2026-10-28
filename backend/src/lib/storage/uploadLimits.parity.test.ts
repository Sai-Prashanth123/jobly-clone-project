import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';


/**
 * The upload limit must be one number, written down once.
 *
 * It was previously three: multer's 20 MB, the frontend's 20 MB, and a local
 * MAX_PROOF_BYTES on the monthly timesheet page — plus the words "20 MB"
 * retyped as prose on six screens. None of them was the limit that actually
 * applied (Lambda's ~4.5 MB was), so every one of the seven was wrong at the
 * same time and nothing caught it.
 *
 * These are source-scanning tests, the established drift guard in this repo:
 * they fail when somebody adds a NEW hard-typed size rather than deriving it.
 */

const ROOT = join(__dirname, '../../../..');
const PORTAL = join(ROOT, 'src', 'portal');
const UTILS = readFileSync(join(PORTAL, 'lib', 'utils.ts'), 'utf8');

/** The frontend limit, read out of its source — this test spans two projects. */
function frontendBytes(): number {
  const m = UTILS.match(/MAX_DOCUMENT_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  expect(m, 'MAX_DOCUMENT_BYTES should be written as N * 1024 * 1024').toBeTruthy();
  return Number(m![1]) * 1024 * 1024;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const FILES = walk(PORTAL).map(f => ({ path: f, text: readFileSync(f, 'utf8') }));

describe('the frontend limit matches the backend', () => {
  it('equals MAX_UPLOAD_BYTES', () => {
    const backend = readFileSync(join(__dirname, 'uploadLimits.ts'), 'utf8');
    const m = backend.match(/MAX_UPLOAD_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
    expect(m, 'MAX_UPLOAD_BYTES should be written as N * 1024 * 1024').toBeTruthy();
    expect(frontendBytes()).toBe(Number(m![1]) * 1024 * 1024);
  });

  it('has a label derived from the number, not typed out', () => {
    expect(frontendBytes()).toBe(100 * 1024 * 1024);
    const utils = UTILS;
    // The label must be computed. A literal '100 MB' here is the bug this
    // whole test file exists to prevent.
    expect(utils).toMatch(/MAX_DOCUMENT_SIZE_LABEL\s*=\s*`\$\{/);
  });
});

describe('nothing retypes a file size in user-facing copy', () => {
  // The profile photo is the one real exception: it is still a 2 MB multipart
  // upload through Lambda, with its own constant, so its copy says 2 MB.
  const ALLOWED = [/max 2 MB/i, /larger than 2 MB/i];

  // Case-SENSITIVE, and that matters: an /i pattern matches Tailwind's own
  // `gap-2 mb-1` as "2 mb" and reported 65 layout classes as size copy.
  const SIZE_IN_PROSE = /\d+\s*MB\b|\d+\s*mb(?![-\w])/;

  it('no screen hard-types an "NN MB" outside the photo lines', () => {
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      for (const line of text.split('\n')) {
        if (!SIZE_IN_PROSE.test(line)) continue;
        // Comments are not copy. Several of them deliberately cite the old
        // 20 MB and the real ~4.5 MB ceiling to explain why this guard exists,
        // and that history is worth keeping.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        if (ALLOWED.some(a => a.test(line))) continue;
        // Deriving from the label or computing from bytes is the correct form.
        if (/MAX_DOCUMENT_SIZE_LABEL|1024 \* 1024/.test(line)) continue;
        offenders.push(`${path.replace(PORTAL, 'src/portal')}: ${line.trim()}`);
      }
    }
    expect(offenders, 'derive from MAX_DOCUMENT_SIZE_LABEL instead').toEqual([]);
  });

  it('declares a byte limit in exactly one place', () => {
    const DECL = /^.*=\s*\d+\s*\*\s*1024\s*\*\s*1024.*$/gm;
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      for (const line of text.match(DECL) ?? []) {
        // The profile photo keeps its own constant — it is a genuinely
        // different limit on a route that still goes through Lambda.
        if (/PHOTO/i.test(line)) continue;
        if (path.endsWith(join('lib', 'utils.ts'))) continue;
        offenders.push(`${path.replace(PORTAL, 'src/portal')}: ${line.trim()}`);
      }
    }
    // MAX_PROOF_BYTES on the monthly timesheet page was the second one, and it
    // silently governed two inputs.
    expect(offenders, 'the limit belongs in lib/utils.ts').toEqual([]);
  });
});

describe('the type whitelist is gone, not just bypassed', () => {
  it('keeps no MIME allow-list in utils', () => {
    const utils = UTILS;
    expect(utils).not.toMatch(/ALLOWED_DOCUMENT_MIME_TYPES/);
    expect(utils).not.toMatch(/IDENTITY_DOC_MIME_TYPES/);
    // The Windows .doc/.docx workaround existed only to paper over the
    // whitelist; it should have gone with it.
    expect(utils).not.toMatch(/hasWordExtension/);
  });

  it('still rejects an empty file, which is a real user mistake', () => {
    expect(frontendBytes()).toBeGreaterThan(0);
    const utils = UTILS;
    expect(utils).toMatch(/file\.size === 0/);
  });
});
