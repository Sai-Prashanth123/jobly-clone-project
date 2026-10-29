import { cn } from '@/lib/utils';

/**
 * A filename with a line of detail under it, inside a row that has buttons.
 *
 * This exists because the same three classes kept being left off and the
 * result is always the same bug: on a phone the buttons end up off the right
 * edge of the screen, unreachable. Measured on the employee Documents card,
 * Preview and Download sat 259px past a 360px viewport.
 *
 * The mechanic, since it is not obvious: a flex item defaults to
 * `min-width: auto`, which floors it at its min-content width. A filename like
 * `SSN_SaiPrabhakaraReddyGuduru_StemExtension_2026.pdf` has no break
 * opportunity, so its min-content width is the whole string and the item
 * refuses to shrink — pushing its siblings out of the viewport.
 *
 * `truncate` on a direct flex child is enough on its own (it sets
 * `overflow: hidden`, which gives the item an automatic minimum size of 0),
 * but the wrapper div around two lines of text is NOT a text element, so it
 * needs the explicit `min-w-0`. Both are therefore here.
 *
 * Modelled on `components/legal/CaseDocumentsPanel.tsx:83-106`, which already
 * had it right. It is a component rather than a documented convention because
 * `DetailField.tsx` tells the story of what happens otherwise — its copies
 * drifted and silently dropped `break-words`.
 *
 * The full name stays reachable via `title`, since truncating hides the tail
 * and filenames often differ only at the end.
 */
export function FileMeta({
  name,
  meta,
  className,
  children,
}: {
  name: string;
  /** The line underneath — usually `Type • date`. */
  meta?: React.ReactNode;
  className?: string;
  /** Badges or flags that belong beside the name. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-medium truncate" title={name}>{name}</p>
        {children}
      </div>
      {meta !== undefined && (
        <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  );
}
