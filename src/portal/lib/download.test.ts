import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDownload } from './download';

/**
 * "When we click the download button for any document, it downloads. However,
 * we are getting open a blank tab on each download action."
 *
 * Four downloads, four about:blank tabs left behind — they were visible in the
 * screenshot. The downloads opened a tab up front to dodge the popup blocker,
 * then pointed it at the signed URL; but that URL carries
 * Content-Disposition: attachment, so the browser saves the file and never
 * navigates, and the tab it opened stays empty forever.
 */
describe('triggerDownload', () => {
  let open: ReturnType<typeof vi.spyOn>;

  beforeEach(() => { open = vi.spyOn(window, 'open').mockImplementation(() => null); });
  afterEach(() => { open.mockRestore(); document.body.innerHTML = ''; });

  it('opens no tab — the whole point', () => {
    triggerDownload('https://example.com/file.pdf');
    expect(open).not.toHaveBeenCalled();
  });

  it('clicks an anchor pointing at the file', () => {
    const clicked: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicked.push(this.href); };
    try {
      triggerDownload('https://example.com/file.pdf');
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(clicked).toEqual(['https://example.com/file.pdf']);
  });

  it('carries the filename when one is known', () => {
    let name = '';
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { name = this.download; };
    try {
      triggerDownload('https://example.com/x', 'Passport.pdf');
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(name).toBe('Passport.pdf');
  });

  // A leftover anchor would pile up one node per download.
  it('leaves nothing behind in the document', () => {
    const before = document.body.children.length;
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};
    try {
      triggerDownload('https://example.com/a');
      triggerDownload('https://example.com/b');
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(document.body.children.length).toBe(before);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('never sets a target, which would bring the tab back', () => {
    let target = 'unset';
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { target = this.target; };
    try {
      triggerDownload('https://example.com/x');
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(target).toBe('');
  });
});
