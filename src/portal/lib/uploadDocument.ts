import axios from 'axios';
import { apiClient } from './apiClient';

/**
 * Upload a file straight to storage, bypassing the API.
 *
 * Files used to be POSTed to our own server as multipart form data, which put
 * them through API Gateway and Lambda. API Gateway base64-encodes a request
 * body before handing it to Lambda, inflating it by a third, and Lambda caps a
 * request at 6 MB — so the real ceiling was about 4.5 MB while every screen
 * promised 20 MB. A 7.9 MB passport was rejected with a bare "Request Entity
 * Too Large" before our code ran at all.
 *
 * Three steps now:
 *   1. ask the server where to put it — it picks the key and signs the URL
 *   2. PUT the bytes directly to storage
 *   3. tell the server it landed, so it can record the document
 *
 * The server never sees the file, so size is a product decision rather than an
 * infrastructure limit.
 */

export interface UploadTarget {
  uploadUrl: string;
  storagePath: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
}

export interface DirectUploadOptions {
  /** Endpoint that issues the signed URL, e.g. `/employees/123/documents/upload-url`. */
  urlEndpoint: string;
  /** Endpoint that records the finished upload, e.g. `/employees/123/documents/register`. */
  registerEndpoint: string;
  file: File;
  /** Extra fields for the register call — name, docType, expiryDate, replace… */
  meta?: Record<string, unknown>;
  /** 0–1. Covers the PUT only, which is the part that takes any time. */
  onProgress?: (fraction: number) => void;
}

export async function uploadFileDirect<T = unknown>(opts: DirectUploadOptions): Promise<T> {
  const { urlEndpoint, registerEndpoint, file, meta = {}, onProgress } = opts;

  // 1. Where to put it. The server chooses the key — a client-supplied path
  //    would let somebody write into another record's folder.
  const { data: urlRes } = await apiClient.post(urlEndpoint, {
    fileName: file.name,
    size: file.size,
  });
  const target = urlRes.data as UploadTarget;

  // 2. Straight to storage.
  //
  //    DELIBERATELY bare `axios`, not `apiClient`. The shared client attaches
  //    `Authorization: Bearer …` to every request, and S3 rejects a request
  //    that carries both a query-string signature and an Authorization header.
  //    It would also prepend the API base URL and run the idle-timeout logic,
  //    neither of which belongs on a request to storage.
  await axios.put(target.uploadUrl, file, {
    // Must match what the server signed, exactly. Left to itself axios infers
    // this from `file.type`, which will not match for anything the server
    // deliberately stores as a plain download (.html, .svg, unknown types),
    // and S3 answers 403 SignatureDoesNotMatch — a confusing failure.
    headers: { 'Content-Type': target.contentType },
    onUploadProgress: e => {
      if (!onProgress) return;
      const total = e.total ?? file.size;
      if (total > 0) onProgress(Math.min(1, e.loaded / total));
    },
  });

  // 3. Record it. The server re-checks the path, confirms the object exists
  //    and reads its real size — none of which it can take our word for.
  const { data: regRes } = await apiClient.post(registerEndpoint, {
    storagePath: target.storagePath,
    fileName: file.name,
    ...meta,
  });
  return regRes.data as T;
}

/**
 * Run uploads a few at a time.
 *
 * The onboarding wizard fires one task per staged file, in parallel. That was
 * fine when each was a single request of at most a few megabytes; now each is
 * three round-trips carrying up to the full limit, and a dozen at once would
 * stall the browser and starve each other.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit = 4,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
