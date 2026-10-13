import * as React from 'react';

/**
 * Flatten a React label down to the text a person would read.
 *
 * The Select's typeahead compared against `typeof label === "string" ? label
 * : ""`, so any item whose children are JSX matched nothing at all. The state
 * pickers render `{s.code} — {s.name}`, which React gives as an array — so
 * every one of the 57 states was unmatchable, and typing "T" for Texas did
 * nothing. 116 countries worked only because those labels happen to be plain
 * strings.
 */
export function labelText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(labelText).join('');
  if (React.isValidElement(node)) {
    return labelText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/** How long a typed prefix stays active before the next keystroke starts over. */
export const TYPEAHEAD_RESET_MS = 700;

/**
 * Pick the item a typed prefix should jump to.
 *
 * Searching from just after the active item, wrapping, so repeatedly pressing
 * the same letter cycles through the matches — the behaviour a native
 * `<select>` has and the one people expect.
 *
 * Matching on prefix rather than substring, also matching the native control:
 * "ind" should find India, not "West Indies".
 */
export function findByPrefix<T extends { value: string; label: React.ReactNode; disabled?: boolean }>(
  items: T[],
  prefix: string,
  activeValue: string | undefined,
): T | undefined {
  const needle = prefix.toLowerCase();
  if (!needle) return undefined;
  const enabled = items.filter(i => !i.disabled);
  if (enabled.length === 0) return undefined;

  // A repeated single character cycles; a longer prefix should settle on the
  // first match rather than skipping past the item already selected.
  const activeIdx = enabled.findIndex(i => i.value === activeValue);
  const start = needle.length === 1 ? activeIdx + 1 : 0;
  const ordered = [...enabled.slice(start), ...enabled.slice(0, Math.max(0, start))];

  return ordered.find(i => labelText(i.label).trim().toLowerCase().startsWith(needle));
}
