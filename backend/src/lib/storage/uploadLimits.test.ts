import { describe, it, expect } from 'vitest';
import {
  MAX_UPLOAD_BYTES, LEGACY_MULTER_MAX_BYTES, RENDER_MAX_BYTES,
  INLINE_SAFE_EXTENSIONS, isInlineSafe, extensionOf, maxUploadLabel,
} from './uploadLimits';
import { contentTypeForFileName, DEFAULT_CONTENT_TYPE } from './contentType';
import { uniqueObjectPath, assertPathBelongsToEntity } from './objectPath';

/**
 * The rules that make "accept every file type, up to 100 MB" safe.
 *
 * Two of these are security properties rather than preferences:
 *
 *   isInlineSafe            decides whether a browser is allowed to RENDER an
 *                           uploaded file. Say yes to .html or .svg and an
 *                           upload can execute script from an amazonaws.com URL.
 *   assertPathBelongsTo…    decides whether a caller may claim an object they
 *                           PUT straight to S3. It is the only thing standing
 *                           between a user and registering someone else's file.
 */

describe('what a browser may render inline', () => {
  it.each([...INLINE_SAFE_EXTENSIONS])('allows .%s', ext => {
    expect(isInlineSafe(`doc.${ext}`)).toBe(true);
  });

  // The whole point of the allowlist.
  it.each(['html', 'htm', 'xhtml', 'svg', 'svgz', 'xml', 'js', 'exe'])(
    'refuses .%s', ext => {
      expect(isInlineSafe(`payload.${ext}`)).toBe(false);
    });

  it('ignores case', () => {
    expect(isInlineSafe('SCAN.PDF')).toBe(true);
    expect(isInlineSafe('Payload.HTML')).toBe(false);
  });

  // The classic bypass: a name that looks like a PDF and is not.
  it('takes the LAST extension, so invoice.pdf.html is html', () => {
    expect(isInlineSafe('invoice.pdf.html')).toBe(false);
    expect(extensionOf('invoice.pdf.html')).toBe('html');
  });

  it('refuses a file with no extension at all', () => {
    expect(isInlineSafe('README')).toBe(false);
    expect(isInlineSafe('')).toBe(false);
    expect(isInlineSafe('.hidden')).toBe(false);
  });

  it('is not fooled by a directory component', () => {
    expect(extensionOf('a.pdf/b')).toBe('');
    expect(isInlineSafe('folder.pdf/evil')).toBe(false);
  });
});

describe('the content type a file is stored with', () => {
  it('keeps real types for things people preview', () => {
    expect(contentTypeForFileName('scan.pdf')).toBe('application/pdf');
    expect(contentTypeForFileName('photo.JPG')).toBe('image/jpeg');
  });

  // The first defence: the browser never gets to serve these as themselves.
  it.each(['page.html', 'logo.svg', 'data.xml', 'thing.xyz', 'README'])(
    'stores %s as a plain download', name => {
      expect(contentTypeForFileName(name)).toBe(DEFAULT_CONTENT_TYPE);
    });

  it('never produces a type a browser would execute', () => {
    const dangerous = ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/javascript'];
    const names = ['a.html', 'a.svg', 'a.xhtml', 'a.js', 'a.pdf', 'a.docx', 'a.csv', 'a'];
    for (const n of names) {
      expect(dangerous, n).not.toContain(contentTypeForFileName(n));
    }
  });

  it('keeps every inline-safe extension mapped to a real type', () => {
    for (const ext of INLINE_SAFE_EXTENSIONS) {
      expect(contentTypeForFileName(`f.${ext}`), ext).not.toBe(DEFAULT_CONTENT_TYPE);
    }
  });
});

describe('proving an uploaded object belongs to the record', () => {
  const entity = '3b79bdb6-d432-4910-8bf5-1a5f0836159f';

  // Generated keys must always satisfy the guard, or legitimate uploads 403.
  it('accepts anything uniqueObjectPath produces', () => {
    for (const name of ['passport.pdf', 'my scan (1).PDF', 'päss.pdf', 'x'.repeat(300) + '.pdf', 'no-ext']) {
      const path = uniqueObjectPath(entity, name);
      expect(() => assertPathBelongsToEntity(entity, path), name).not.toThrow();
    }
  });

  it('accepts a nested prefix, as the timesheet surfaces use', () => {
    const path = uniqueObjectPath('weekly/ts-123', 'proof.pdf');
    expect(() => assertPathBelongsToEntity('weekly/ts-123', path)).not.toThrow();
  });

  // Each of these is somebody claiming a file that is not theirs.
  it.each([
    ['another entity', 'ae9f62ab-0beb-41d1-8af1-8f4715b5df62/1234567890-abcdef12-x.pdf'],
    ['traversal', `${entity}/../other/1234567890-abcdef12-x.pdf`],
    ['leading slash', `/${entity}/1234567890-abcdef12-x.pdf`],
    ['bare filename', 'x.pdf'],
    ['no unique part', `${entity}/x.pdf`],
    ['extra segment', `${entity}/sub/1234567890-abcdef12-x.pdf`],
    ['empty', ''],
  ])('rejects %s', (_label, path) => {
    expect(() => assertPathBelongsToEntity(entity, path)).toThrow();
  });

  // A prefix is interpolated into a RegExp — a crafted one must not widen it.
  it('does not let a regex-special prefix match more than itself', () => {
    expect(() => assertPathBelongsToEntity('a.c', 'abc/1234567890-abcdef12-x.pdf')).toThrow();
  });
});

describe('the limits themselves', () => {
  it('is 100 MB, and says so', () => {
    expect(MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024);
    expect(maxUploadLabel()).toBe('100 MB');
  });

  // The old path genuinely cannot carry more than ~4.5 MiB; claiming otherwise
  // is what produced a 413 nobody could explain.
  it('keeps the legacy multer limit under what Lambda can actually accept', () => {
    const lambdaPayload = 6 * 1024 * 1024;
    expect(LEGACY_MULTER_MAX_BYTES).toBeLessThan(lambdaPayload * 3 / 4);
  });

  it('will not try to render something too big for a Lambda response', () => {
    expect(RENDER_MAX_BYTES).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(RENDER_MAX_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
