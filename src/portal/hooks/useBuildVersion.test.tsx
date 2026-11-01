import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useBuildVersion } from './useBuildVersion';

/**
 * Telling a stale tab it is stale.
 *
 * A fix for the upload limit and one for scroll position both shipped and were
 * reported back as "this is not done", from a tab that had been open since the
 * day before. So the tab re-reads index.html and compares the hashed assets it
 * names against the ones it booted with.
 *
 * The cases below pin the comparison itself: it must fire on a stylesheet-only
 * change (no JS hash need move for one) and stay silent when nothing moved,
 * which is the failure that matters — a check that announces on every focus is
 * worse than none.
 */

const info = vi.fn();
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => info(...a) } }));

const shell = (entry: string, css: string) => `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/${entry}"></script>
  <link rel="modulepreload" crossorigin href="/assets/vendor-react-yW9LoAOW.js">
  <link rel="stylesheet" crossorigin href="/assets/${css}">
</head><body><div id="root"></div></body></html>`;

const fetchMock = vi.fn();

function serve(...bodies: string[]) {
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => body });
  }
}

/** Past the hook's five-minute floor, without waiting five minutes. */
function jumpAheadTenMinutes() {
  const base = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => base + 10 * 60 * 1000);
}

const render = () =>
  renderHook(() => useBuildVersion(), { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

beforeEach(() => {
  info.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBuildVersion', () => {
  it('says nothing on the first look', async () => {
    serve(shell('index-AAAA1111.js', 'index-CSS00001.css'));
    render();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // The first answer is the baseline, not a change.
    expect(info).not.toHaveBeenCalled();
  });

  it('notices a stylesheet-only deploy', async () => {
    // No JS hash moved here. The old check matched assets/index-*.js alone and
    // would have stayed quiet.
    serve(
      shell('index-AAAA1111.js', 'index-CSS00001.css'),
      shell('index-AAAA1111.js', 'index-CSS00002.css'),
    );
    render();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    jumpAheadTenMinutes();
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(info).toHaveBeenCalledTimes(1));
    expect(String(info.mock.calls[0][0])).toMatch(/new version/i);
  });

  it('stays silent when the build has not moved', async () => {
    const same = shell('index-AAAA1111.js', 'index-CSS00001.css');
    serve(same, same);
    render();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    jumpAheadTenMinutes();
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(info).not.toHaveBeenCalled();
  });

  it('keeps quiet when index.html cannot be read', async () => {
    // Offline, or a login redirect answering with something that is not the
    // app shell. Not knowing must never produce a prompt.
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '<html><body>Sign in</body></html>' });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    render();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    jumpAheadTenMinutes();
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(info).not.toHaveBeenCalled();
  });
});
