import { useState, useEffect, useRef } from 'react';
import { X, Download, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '../../lib/apiClient';

interface DocumentPreviewDialogProps {
  docId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extLabel(fileName: string) {
  return (fileName.split('.').pop() ?? 'file').toUpperCase();
}

type RenderResult = {
  kind: 'docx' | 'sheet' | 'text' | 'passthrough';
  html: string;
  name: string;
  inlineUrl?: string;
};

export function DocumentPreviewDialog({ docId, fileName, open, onOpenChange }: DocumentPreviewDialogProps) {
  const [render, setRender] = useState<RenderResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Put the page back where it was when the preview closes.
  //
  // Radix locks body scroll while a dialog is open and does not reliably
  // restore the offset afterwards, so closing a preview dropped the user at
  // the very top of the page. On a form as long as onboarding that means
  // losing your place entirely and scrolling back to the row you were on.
  //
  // `wasOpen` guards the first render: without it the effect would "restore"
  // position 0 on mount and scroll a freshly-loaded page to the top.
  const scrollYRef = useRef(0);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      scrollYRef.current = window.scrollY;
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const target = scrollYRef.current;
    if (target <= 0) return;

    // Keep restoring until it sticks, rather than guessing how many frames
    // Radix needs. The previous version used exactly two requestAnimationFrames
    // — enough on a fast machine, not enough when the unmount and the
    // scroll-lock cleanup land in different frames, which is why the page still
    // jumped to the top for some people. Radix removes `overflow:hidden` (and
    // on some paths a `position:fixed`) from <body> on close, and the browser
    // resets scrollY as that happens; whichever frame that falls on, one of
    // these attempts lands after it.
    //
    // Gives up after ~500ms so this can never fight a user who has deliberately
    // scrolled somewhere else in the meantime.
    let cancelled = false;
    let raf = 0;
    const deadline = performance.now() + 500;

    const restore = () => {
      if (cancelled) return;
      if (Math.abs(window.scrollY - target) > 2) {
        // behavior:'instant' is essential. The legacy Bootstrap stylesheet sets
        // `scroll-behavior: smooth` on :root, so a plain scrollTo ANIMATES —
        // and re-issuing it each frame kept restarting the animation, which
        // sailed past the target (measured: asked for 900, landed on 1036).
        // Jumping straight there also looks right: the user never perceives
        // having left the spot.
        window.scrollTo({ top: target, left: 0, behavior: 'instant' as ScrollBehavior });
      }
      if (performance.now() < deadline) raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);

    // Stop early the moment the user scrolls themselves — otherwise the loop
    // would drag them back for up to half a second.
    const onUserScroll = () => {
      if (Math.abs(window.scrollY - target) > 40) { cancelled = true; }
    };
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchmove', onUserScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !docId) return;
    setRender(null);
    setDownloadUrl(null);
    setError(null);
    setLoading(true);

    Promise.all([
      apiClient.get(`/documents/${docId}/render`).then(r => r.data?.data as RenderResult),
      apiClient.get(`/documents/${docId}/url`).then(r => r.data?.data?.url as string | null),
    ])
      .then(([renderData, dlUrl]) => {
        setRender(renderData);
        setDownloadUrl(dlUrl ?? null);
      })
      .catch(() => {
        setError('Could not load this document. Use the Download button instead.');
      })
      .finally(() => setLoading(false));
  }, [open, docId]);

  const handleDownload = () => {
    if (!downloadUrl) { toast.error('Download link not available.'); return; }
    const win = window.open('about:blank', '_blank');
    if (win) win.location.href = downloadUrl;
    else window.location.href = downloadUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] h-[92vh] max-w-6xl p-0 flex flex-col gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Document Preview: {fileName}</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
            <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
              {extLabel(fileName)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={!downloadUrl}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 bg-gray-50 relative flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 max-w-sm text-center p-6">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-gray-600">{error}</p>
              <Button onClick={handleDownload} disabled={!downloadUrl} className="gap-2">
                <Download className="h-4 w-4" /> Download instead
              </Button>
            </div>
          )}

          {/* PDF / images — native browser renderer via inline signed URL */}
          {!loading && !error && render?.kind === 'passthrough' && render.inlineUrl && (
            (() => {
              const ext = (fileName.split('.').pop() ?? '').toLowerCase();
              const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext);
              return isImage ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img src={render.inlineUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded shadow" />
                </div>
              ) : (
                <iframe src={render.inlineUrl} title={fileName} className="w-full h-full border-0" />
              );
            })()
          )}

          {/* DOCX / XLSX / TXT — rendered server-side, shown as srcdoc iframe */}
          {!loading && !error && render && render.kind !== 'passthrough' && render.html && (
            <iframe
              srcDoc={render.html}
              title={fileName}
              sandbox="allow-same-origin"
              className="w-full h-full border-0 bg-white"
            />
          )}

          {/* Passthrough with no URL, or empty HTML — unsupported format */}
          {!loading && !error && render?.kind === 'passthrough' && !render.inlineUrl && (
            <div className="flex flex-col items-center gap-3 max-w-sm text-center p-6">
              <FileText className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Preview not available</p>
              <p className="text-xs text-muted-foreground">
                .{(fileName.split('.').pop() ?? 'unknown')} files cannot be previewed.
              </p>
              {/* Legacy Office formats are the common case and the one the
                  uploader can actually do something about: .doc/.xls/.ppt are
                  pre-2007 binary formats that no browser-side renderer reads.
                  Saying so beats leaving people to wonder if the file is
                  broken — it downloads and opens perfectly well. */}
              {/* .doc is no longer listed: legacy Word is extracted and rendered
                  server-side now. .xls and .ppt still have no renderer, so the
                  hint stays useful for those. */}
              {['xls', 'ppt'].includes((fileName.split('.').pop() ?? '').toLowerCase()) && (
                <p className="text-xs text-muted-foreground">
                  This is an older Office format. Re-saving it as
                  {' '}<strong>.{(fileName.split('.').pop() ?? '').toLowerCase()}x</strong>{' '}
                  and re-uploading will make it previewable.
                </p>
              )}
              <Button onClick={handleDownload} disabled={!downloadUrl} className="gap-2 mt-2">
                <Download className="h-4 w-4" /> Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
