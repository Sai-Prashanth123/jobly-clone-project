import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_DOCUMENT_BYTES } from '../../lib/utils';

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
  onAdd: (file: File) => void;
  onRemoveStaged: (idx: number) => void;
  accept?: string;
}

/** Upload control for identity-doc rows that allow more than one file of the
 * same type (I-983, I-20, Other Documents) — shows already-uploaded docs and
 * staged-but-unsaved files as chips, with an "Add another" control that
 * disappears once existingDocs + stagedFiles reaches maxFiles. */
export function MultiFileUploadSlot({
  inputId, existingDocs, stagedFiles, maxFiles, onAdd, onRemoveStaged, accept = '.pdf,.jpg,.jpeg,.png',
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
              accept={accept}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
                  toast.error('Please upload a PDF, JPEG, or PNG file.');
                  e.target.value = '';
                  return;
                }
                if (f.size > MAX_DOCUMENT_BYTES) {
                  toast.error(`${f.name} is larger than ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB.`);
                  e.target.value = '';
                  return;
                }
                onAdd(f);
                e.target.value = '';
              }}
            />
          </>
        )}
        {total > 0 && <span className="text-[11px] text-gray-400">{total}/{maxFiles}</span>}
      </div>
    </div>
  );
}
