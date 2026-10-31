import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { IDENTITY_DOC_ACCEPT, validateIdentityDocFile } from '../../lib/utils';

interface ExistingDoc {
  id?: string;
  name?: string;
  type?: string;
}

interface MultiFileUploadSlotProps {
  inputId: string;
  existingDocs: ExistingDoc[];
  stagedFiles: File[];
  maxFiles: number;
  /**
   * Takes a LIST, because people pick a whole set at once.
   *
   * It used to take a single File, and the input had no `multiple` attribute,
   * so selecting ten I-20s staged one and the other nine were dropped without
   * a word — reported as "it is only picking 1 or 2 documents at a time".
   */
  onAdd: (files: File[]) => void;
  onRemoveStaged: (idx: number) => void;
  /**
   * Delete a file that is already saved against the employee.
   *
   * Optional because the wizard has nothing to delete yet — on a new employee
   * every file is still staged. Passed in edit mode, where the same slot had
   * no way at all to remove a saved file: one employee uploaded the same PDF
   * eight times and neither they nor HR could clear the duplicates, despite
   * both having permission to. The only delete lived on the Documents page.
   */
  onRemoveExisting?: (doc: ExistingDoc) => void;
  accept?: string;
}

/** Upload control for identity-doc rows that allow more than one file of the
 * same type (I-983, I-20, Other Documents) — shows already-uploaded docs and
 * staged-but-unsaved files as chips, with an "Add another" control that
 * disappears once existingDocs + stagedFiles reaches maxFiles. */
export function MultiFileUploadSlot({
  inputId, existingDocs, stagedFiles, maxFiles, onAdd, onRemoveStaged, onRemoveExisting,
  accept = IDENTITY_DOC_ACCEPT,
}: MultiFileUploadSlotProps) {
  const total = existingDocs.length + stagedFiles.length;
  const atLimit = total >= maxFiles;

  return (
    <div className="flex flex-col gap-2">
      {(existingDocs.length > 0 || stagedFiles.length > 0) && (
        <ul className="flex flex-col gap-1">
          {existingDocs.map((doc, i) => (
            <li key={doc.id ?? `existing_${i}`} className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium flex-shrink-0">
                On file
              </span>
              <span className="text-gray-500 truncate" title={doc.name}>{doc.name}</span>
              {onRemoveExisting && doc.id && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(doc)}
                  className="text-red-600 hover:text-red-700 underline-offset-2 hover:underline ml-auto flex-shrink-0"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
          {stagedFiles.map((file, i) => (
            <li key={`staged_${i}`} className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium flex-shrink-0">
                Uploaded
              </span>
              <span className="text-gray-500 truncate" title={file.name}>{file.name}</span>
              <button
                type="button"
                onClick={() => onRemoveStaged(i)}
                className="text-red-600 hover:text-red-700 underline-offset-2 hover:underline ml-auto flex-shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        {!atLimit && (
          <>
            <label
              htmlFor={inputId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-[#4069FF] hover:text-[#4069FF] cursor-pointer transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {total > 0 ? 'Add another' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={e => {
                const picked = Array.from(e.target.files ?? []);
                // Always clear, even on an early return: without it, picking
                // the same file again fires no change event and looks broken.
                e.target.value = '';
                if (picked.length === 0) return;

                // Report rejects by name rather than failing the whole batch.
                // Someone selecting eight documents should not lose the seven
                // good ones because the eighth was empty.
                const rejected: string[] = [];
                const valid = picked.filter(f => {
                  const err = validateIdentityDocFile(f);
                  if (err) { rejected.push(`${f.name}: ${err}`); return false; }
                  return true;
                });

                const room = Math.max(0, maxFiles - total);
                const accepted = valid.slice(0, room);
                const overflow = valid.length - accepted.length;

                if (accepted.length > 0) onAdd(accepted);

                if (rejected.length > 0) {
                  toast.error(
                    rejected.length === 1 ? rejected[0] : `${rejected.length} files could not be added`,
                    rejected.length > 1 ? { description: rejected.join('\n') } : undefined,
                  );
                }
                if (overflow > 0) {
                  // The old silence here is the whole reason this was reported
                  // as files vanishing.
                  toast.warning(
                    `Added ${accepted.length} — ${overflow} more did not fit`,
                    { description: `This document type holds ${maxFiles} files.` },
                  );
                }
              }}
            />
          </>
        )}
        {total > 0 && <span className="text-[11px] text-gray-400">{total}/{maxFiles}</span>}
      </div>
    </div>
  );
}
