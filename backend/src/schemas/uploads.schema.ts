import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../lib/storage/uploadLimits';

/**
 * Asking for somewhere to put a file, and then saying you put it there.
 *
 * Large uploads no longer pass through this server — the browser PUTs straight
 * to storage — so these two small JSON bodies are all it ever sees. Everything
 * that used to be implicit in receiving the bytes is now either checked
 * against storage (existence, real size) or derived server-side (the key, the
 * content type); see storage.service.registerUploadedDocument.
 */

export const createUploadUrlSchema = z.object({
  // Only ever used to derive an extension and a sanitised key segment. The
  // stored name comes from here too, but safeFileName strips anything that
  // could escape the prefix.
  fileName: z.string().trim().min(1).max(255),
  // An early, friendly rejection so an obviously oversize file is refused
  // before a URL is minted. NOT the real enforcement: the client reports this
  // and the client cannot be trusted, so the true check reads the object's
  // size out of storage after the upload.
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
});

export const registerDocumentSchema = z.object({
  // Compared against the prefix this caller is allowed to write to, so a
  // forged value cannot reach another record's files.
  storagePath: z.string().trim().min(1).max(1024),
  fileName: z.string().trim().min(1).max(255),
  name: z.string().trim().max(255).optional(),
  docType: z.string().trim().max(120).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  // Real boolean here, unlike the multipart path where everything arrives as
  // a string and has to be compared loosely.
  replace: z.boolean().optional(),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;
export type RegisterDocumentInput = z.infer<typeof registerDocumentSchema>;
