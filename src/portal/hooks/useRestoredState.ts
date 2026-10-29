import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * useState that survives leaving the page and pressing Back.
 *
 * Restoring a scroll offset is not enough on a paginated list. From page 3,
 * opening a record and pressing Back rebuilt the table from scratch —
 * `useState(1)` — so you landed on page 1 with page 3's scroll offset applied
 * to entirely different rows. The reader's place was gone either way.
 *
 * Keyed on the history entry, like the scroll offsets, so the semantics match:
 * going Back finds what that entry left behind, while arriving fresh from the
 * sidebar starts clean at page 1 with no filter.
 *
 * Module scope rather than sessionStorage: this is worth nothing after a
 * reload, and a plain Map keeps writes free.
 */
const store = new Map<string, unknown>();

/** Exported for tests, which must not inherit another case's state. */
export function clearRestoredState(): void {
  store.clear();
}

export function useRestoredState<T>(
  id: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { key } = useLocation();
  const storeKey = `${key}::${id}`;

  // Read once, on mount. A list page unmounts when you navigate away and
  // mounts again on Back, so the initialiser always runs with the key that
  // matters. A component that stayed mounted across a key change would keep
  // the old value — nothing in the portal does that, and the alternative
  // (resetting on key change) would throw away state on every re-render of a
  // nested route.
  const [value, setValue] = useState<T>(() =>
    store.has(storeKey) ? (store.get(storeKey) as T) : initial,
  );

  useEffect(() => { store.set(storeKey, value); }, [storeKey, value]);

  return [value, setValue];
}
