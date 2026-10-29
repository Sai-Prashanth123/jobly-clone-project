import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Make a Back button actually go back.
 *
 * Every detail page's Back button called `navigate('/portal/<list>')`, which
 * PUSHES a new history entry rather than returning to the old one. It looks
 * identical — you end up on the list — but it is a different entry, with a
 * different `location.key`, so the scroll offset saved against the entry you
 * came from is never found and the list opens at the top.
 *
 * That is the bug behind "I click into someone from the middle of the list,
 * press Back, and it starts from the beginning again". Restoring scroll could
 * not fix it, because by the time the list rendered it was a brand new visit
 * as far as the router was concerned.
 *
 * Falls back to the given route when there is nothing behind this entry —
 * `key === 'default'` means the session started here, which is what happens
 * when someone opens a link to a record directly. Going "back" then would
 * leave the app entirely.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();

  return useCallback(() => {
    if (key !== 'default') navigate(-1);
    else navigate(fallback);
  }, [navigate, key, fallback]);
}
