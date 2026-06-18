import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '../../lib/apiClient';

interface DocumentPreviewDialogProps {
  docId: string;
  fileName: string;
  mimeType?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isImage(mime?: string | null, name?: string) {
  if (mime && /^image\//i.test(mime)) return true;
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext ?? '');
  }
  return false;
}

function isPdf(mime?: string | null, name?: string) {
  if (mime === 'application/pdf') return true;
  if (name?.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

export function DocumentPreviewDialog({
  docId,
  fileName,
  mimeType,
  open,
  onOpenChange,
}: DocumentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState<string | null>(mimeType ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !docId) return;
    setPreviewUrl(null);
    setDownloadUrl(null);
    setError(null);
    setLoading(true);

    Promise.all([
      apiClient.get(`/documents/${docId}/preview-url`).then(r => r.data?.data),
      apiClient.get(`/documents/${docId}/url`).then(r => r.data?.data?.url),
    ])
      .then(([previewData, dlUrl]) => {
        setPreviewUrl(previewData?.url ?? null);
        setDownloadUrl(dlUrl ?? null);
        if (previewData?.mimeType) setResolvedMime(previewData.mimeType);
      })
      .catch(() => {
        setError('Could not load this document. Please try the Download button instead.');
      })
      .finally(() => setLoading(false));
  }, [open, docId]);

  const handleDownload = () => {
    if (!downloadUrl) { toast.error('Download link not available.'); return; }
    const win = window.open('about:blank', '_blank');
    if (win) win.location.href = downloadUrl;
    else window.location.href = downloadUrl;
  };

  const showImage = isImage(resolvedMime, fileName);
  const showPdf = !showImage && isPdf(resolvedMime, fileName);
  const canPreview = showImage || showPdf;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] h-[92vh] max-w-6xl p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
            {resolvedMime && (
              <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                {resolvedMime.split('/').pop()?.toUpperCase()}
              </span>
            )}
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

          {!loading && !error && previewUrl && canPreview && showPdf && (
            <iframe
              src={previewUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}

          {!loading && !error && previewUrl && canPreview && showImage && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded shadow"
              />
            </div>
          )}

          {!loading && !error && previewUrl && !canPreview && (
            <div className="flex flex-col items-center gap-3 max-w-sm text-center p-6">
              <FileText className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Preview not available</p>
              <p className="text-xs text-muted-foreground">
                This file type ({resolvedMime ?? 'unknown'}) cannot be previewed in the browser.
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
