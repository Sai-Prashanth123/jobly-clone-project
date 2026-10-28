import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nothing may serve an uploaded file inline unless its type is safe.
 *
 * The MIME whitelist is gone, so a person can now store an .html or .svg file.
 * That is only acceptable while the files come BACK as downloads. The two
 * halves shipped together on purpose, and this test is what keeps them
 * together: removing a conditional here is the single edit that would make the
 * portal less safe than it was before any of this work.
 *
 * To be clear about the exposure, so this is neither over- nor under-sold: S3
 * serves from a different origin than the portal, so an uploaded page cannot
 * read a session or call the API as the viewer. The risk is a convincing
 * phishing page on an amazonaws.com URL. That is worth two conditionals.
 */

const SRC = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * `signedUrl(...)` calls with the text around them.
 *
 * Context BEFORE the call matters as much as after: renderDocument's inline
 * branch is `if (isInlineSafe(name)) { … signedUrl(…) }`, so a forward-only
 * window reports a correctly guarded call as unguarded.
 */
function signedUrlCalls(text: string): string[] {
  const out: string[] = [];
  const re = /storageProvider\.signedUrl\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(text.slice(Math.max(0, m.index - 220), m.index + 320));
  }
  return out;
}

const SERVING_FILES = [
  'services/storage.service.ts',
  'services/timesheets.service.ts',
  'services/monthlyTimesheets.service.ts',
  'services/expenses.service.ts',
  'services/invoices.service.ts',
];

describe('every inline-capable signed URL is guarded', () => {
  it('each signedUrl call either forces a download or checks isInlineSafe', () => {
    const unguarded: string[] = [];

    for (const rel of SERVING_FILES) {
      for (const call of signedUrlCalls(read(rel))) {
        // Three acceptable shapes:
        //   download: …            always an attachment
        //   isInlineSafe(…) ? …    conditional, the new pattern
        //   a system-generated PDF we produced ourselves
        if (/download:/.test(call)) continue;
        if (/isInlineSafe\(/.test(call)) continue;
        unguarded.push(`${rel}: ${call.split('\n').slice(0, 3).join(' ').trim()}`);
      }
    }

    expect(
      unguarded,
      'add `download:` or an isInlineSafe conditional — see uploadLimits.INLINE_SAFE_EXTENSIONS',
    ).toEqual([]);
  });
});

describe('the whitelist really is gone', () => {
  it('multer accepts every type, and keeps an honest size limit', () => {
    const upload = read('middleware/upload.ts');
    expect(upload).not.toMatch(/ALLOWED_MIME_TYPES/);
    // The 20 MB it used to claim was never reachable through Lambda.
    expect(upload).not.toMatch(/20 \* 1024 \* 1024/);
    expect(upload).toMatch(/LEGACY_MULTER_MAX_BYTES/);
    // documentUpload must have no fileFilter at all; only the photo route does.
    const docBlock = upload.slice(upload.indexOf('documentUpload'), upload.indexOf('photoUpload'));
    expect(docBlock).not.toMatch(/fileFilter/);
  });

  it('an oversize multipart upload is a 413, not a 500', () => {
    const handler = read('middleware/errorHandler.ts');
    expect(handler).toMatch(/MulterError/);
    expect(handler).toMatch(/413/);
    // Must come before the DB classifier, which switches on err.code — and a
    // MulterError's code is a string, not a SQLSTATE.
    expect(handler.indexOf('MulterError')).toBeLessThan(handler.indexOf('appErrorFromDbError(err)'));
  });
});

describe('the functions that pull whole files into memory are capped', () => {
  it('renderDocument and downloadDocumentBuffer both check the size first', () => {
    const svc = read('services/storage.service.ts');
    const guards = svc.match(/RENDER_MAX_BYTES/g) ?? [];
    // One per function. Without these, raising the limit turns a working
    // preview into a 500 on any large spreadsheet.
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });
});
