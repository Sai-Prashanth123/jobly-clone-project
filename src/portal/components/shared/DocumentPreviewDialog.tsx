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
