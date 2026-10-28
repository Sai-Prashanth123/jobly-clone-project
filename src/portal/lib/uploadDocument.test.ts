import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
const put = vi.fn();

vi.mock('./apiClient', () => ({ apiClient: { post: (...a: unknown[]) => post(...(a as [])) } }));
vi.mock('axios', () => ({ default: { put: (...a: unknown[]) => put(...(a as [])) } }));

import { uploadFileDirect, runWithConcurrency } from './uploadDocument';

/**
 * Uploading straight to storage.
 *
 * The two assertions that matter most here are about the PUT, because both
 * failure modes are confusing enough to cost an afternoon:
 *
 *   an Authorization header   S3 rejects a request carrying both a
 *                             query-string signature and an auth header, and
 *                             our shared apiClient attaches one to everything.
 *   the wrong Content-Type    the type is part of the signature, so anything
 *                             other than what the server signed comes back as
 *                             403 SignatureDoesNotMatch.
 */

const TARGET = {
  uploadUrl: 'https://bucket.s3.us-east-1.amazonaws.com/private/x?X-Amz-Signature=abc',
  storagePath: 'emp-1/1700000000-abcdef12-passport.pdf',
  contentType: 'application/pdf',
  maxBytes: 104857600,
  expiresInSeconds: 900,
};

const file = (name = 'passport.pdf', type = 'application/pdf') =>
  new File(['x'.repeat(64)], name, { type });

const run = (over: Record<string, unknown> = {}) => uploadFileDirect({
  urlEndpoint: '/employees/emp-1/documents/upload-url',
  registerEndpoint: '/employees/emp-1/documents/register',
  file: file(),
  ...over,
} as Parameters<typeof uploadFileDirect>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  post.mockImplementation((url: string) =>
    url.endsWith('/upload-url')
      ? Promise.resolve({ data: { data: TARGET } })
      : Promise.resolve({ data: { data: { id: 'doc-1' } } }));
  put.mockResolvedValue({});
});

describe('the PUT to storage', () => {
  it('goes to the signed URL the server returned', async () => {
    await run();
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(TARGET.uploadUrl);
  });

  // apiClient attaches a Bearer token to every request; S3 refuses that
  // alongside a query-string signature.
  it('carries no Authorization header', async () => {
    await run();
    const cfg = put.mock.calls[0][2] as { headers?: Record<string, string> };
    const names = Object.keys(cfg.headers ?? {}).map(h => h.toLowerCase());
    expect(names).not.toContain('authorization');
  });

  it('sends exactly the Content-Type that was signed', async () => {
    post.mockImplementation((url: string) =>
      url.endsWith('/upload-url')
        ? Promise.resolve({ data: { data: { ...TARGET, contentType: 'application/octet-stream' } } })
        : Promise.resolve({ data: { data: { id: 'doc-1' } } }));

    // A .html file the server deliberately stores as a plain download — the
    // browser's own idea of the type would be text/html and would not match.
    await run({ file: file('page.html', 'text/html') });
    const cfg = put.mock.calls[0][2] as { headers: Record<string, string> };
    expect(cfg.headers['Content-Type']).toBe('application/octet-stream');
  });

  it('reports progress', async () => {
    const seen: number[] = [];
    put.mockImplementation((_u: string, _b: unknown, cfg: { onUploadProgress: (e: unknown) => void }) => {
      cfg.onUploadProgress({ loaded: 32, total: 64 });
      cfg.onUploadProgress({ loaded: 64, total: 64 });
      return Promise.resolve({});
    });
    await run({ onProgress: (f: number) => seen.push(f) });
    expect(seen).toEqual([0.5, 1]);
  });
});

describe('the three steps', () => {
  it('asks, uploads, then registers the server-chosen path', async () => {
    await run({ meta: { name: 'Passport', docType: 'Passport' } });

    expect(post.mock.calls[0][0]).toContain('/upload-url');
    expect(post.mock.calls[0][1]).toMatchObject({ fileName: 'passport.pdf' });

    const [registerUrl, body] = post.mock.calls[1] as [string, Record<string, unknown>];
    expect(registerUrl).toContain('/register');
    // Echoed back verbatim — the client never invents a path.
    expect(body.storagePath).toBe(TARGET.storagePath);
    expect(body).toMatchObject({ name: 'Passport', docType: 'Passport' });
  });

  // A half-finished upload must not become a document row pointing at nothing.
  it('does not register when the upload fails', async () => {
    put.mockRejectedValue(new Error('network'));
    await expect(run()).rejects.toThrow('network');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain('/upload-url');
  });

  it('does not upload when no URL could be issued', async () => {
    post.mockRejectedValue(new Error('too large'));
    await expect(run()).rejects.toThrow('too large');
    expect(put).not.toHaveBeenCalled();
  });
});

describe('running several uploads at once', () => {
  it('never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, () => async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 2));
      active--;
      return 'ok';
    });
    const out = await runWithConcurrency(tasks, 4);
    expect(peak).toBeLessThanOrEqual(4);
    expect(out).toHaveLength(12);
    expect(out.every(r => r.status === 'fulfilled')).toBe(true);
  });

  // Matches Promise.allSettled: one bad file must not abandon the rest.
  it('keeps going when one task fails, and reports results in order', async () => {
    const out = await runWithConcurrency([
      async () => 'a',
      async () => { throw new Error('bad'); },
      async () => 'c',
    ], 2);
    expect(out.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(out[2]).toMatchObject({ value: 'c' });
  });

  it('handles an empty list', async () => {
    expect(await runWithConcurrency([], 4)).toEqual([]);
  });
});
