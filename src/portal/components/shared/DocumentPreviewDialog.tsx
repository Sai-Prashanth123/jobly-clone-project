import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '../../lib/apiClient';

interface DocumentPreviewDialogProps {
  docId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FileKind = 'pdf' | 'image' | 'office' | 'text' | 'unknown';

function getFileKind(fileName: string): FileKind {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg','jpeg','png','gif','webp','svg','bmp','tiff','tif'].includes(ext)) return 'image';
  if (['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)) return 'office';
  if (['txt','csv','md','json','xml','html','htm'].includes(ext)) return 'text';
  return 'unknown';
}

function extLabel(fileName: string) {
  return (fileName.split('.').pop() ?? 'file').toUpperCase();
}

export function DocumentPreviewDialog({ docId, fileName, open, onOpenChange }: DocumentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = getFileKind(fileName);

  useEffect(() => {
    if (!open || !docId) return;
    setPreviewUrl(null);
    setDownloadUrl(null);
    setTextContent(null);
    setError(null);
    setLoading(true);

    Promise.all([
      apiClient.get(`/documents/${docId}/preview-url`).then(r => r.data?.data?.url as string | null),
      apiClient.get(`/documents/${docId}/url`).then(r => r.data?.data?.url as string | null),
    ])
      .then(async ([pvUrl, dlUrl]) => {
        setPreviewUrl(pvUrl ?? null);
        setDownloadUrl(dlUrl ?? null);

        // For text/CSV fetch the raw content so we can render it inline
        if (kind === 'text' && pvUrl) {
          try {
            const res = await fetch(pvUrl);
            const txt = await res.text();
            setTextContent(txt);
          } catch {
            // If fetch fails the Google viewer iframe will be the fallback
          }
        }
      })
      .catch(() => {
        setError('Could not load this document. Please try the Download button instead.');
      })
      .finally(() => setLoading(false));
  }, [open, docId, kind]);

  const handleDownload = () => {
    if (!downloadUrl) { toast.error('Download link not available.'); return; }
    const win = window.open('about:blank', '_blank');
    if (win) win.location.href = downloadUrl;
    else window.location.href = downloadUrl;
  };

  // Google Docs Viewer works for PDF, Office, and most text formats.
  // The signed URL is publicly accessible (token in the URL), so the viewer can fetch it.
  const googleViewerUrl = previewUrl
    ? `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(previewUrl)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] h-[92vh] max-w-6xl p-0 flex flex-col gap-0 overflow-hidden">
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

          {/* PDF — browser native renderer */}
          {!loading && !error && previewUrl && kind === 'pdf' && (
            <iframe
              src={previewUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}

          {/* Images — direct render */}
          {!loading && !error && previewUrl && kind === 'image' && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded shadow"
              />
            </div>
          )}

          {/* Office docs (docx, xlsx, pptx, doc, xls, ppt) — Google Docs Viewer */}
          {!loading && !error && googleViewerUrl && kind === 'office' && (
            <iframe
              src={googleViewerUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}

          {/* Text / CSV — inline pre, or Google viewer as fallback */}
          {!loading && !error && kind === 'text' && (
            textContent != null ? (
              <div className="w-full h-full overflow-auto p-4">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words bg-white rounded border p-4 min-h-full">
                  {textContent}
                </pre>
              </div>
            ) : googleViewerUrl ? (
              <iframe
                src={googleViewerUrl}
                title={fileName}
                className="w-full h-full border-0"
              />
            ) : null
          )}

          {/* Unknown format — download prompt */}
          {!loading && !error && kind === 'unknown' && (
            <div className="flex flex-col items-center gap-3 max-w-sm text-center p-6">
              <FileText className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Preview not available</p>
              <p className="text-xs text-muted-foreground">
                .{(fileName.split('.').pop() ?? 'unknown')} files cannot be previewed in the browser.
              </p>
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
