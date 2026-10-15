/**
 * Save a file without leaving a blank tab behind.
 *
 * Every download here used to open `about:blank` synchronously — to dodge the
 * popup blocker, since the signed URL only arrives after an await — and then
 * point that tab at the URL. But the backend signs these with
 * `Content-Disposition: attachment`, so the browser SAVES the file and never
 * navigates: the tab it opened just sits there, empty, forever. Four downloads
 * meant four blank tabs, which is exactly what was reported.
 *
 * An anchor click does the same job with no tab at all. Because the response
 * is an attachment the page does not navigate either, so the SPA keeps its
 * state — no popup blocker to dodge in the first place.
 *
 * `download` is advisory: browsers ignore it cross-origin, which S3 is. It
 * costs nothing and gives a sensible filename on the same-origin paths, while
 * the real naming comes from the Content-Disposition header the signer sets.
 */
export function triggerDownload(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  // No `target`: a target would reintroduce the empty tab this exists to
  // avoid. noopener/noreferrer stay as a matter of hygiene for the one case
  // where a browser does decide to open a window.
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
