import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '../../lib/apiClient';

// Documents live in a PRIVATE bucket (they hold SSNs, W-9s, bank letters), so
// their URLs are short-lived signed URLs. The URL saved at upload time expires
// after ~1 hour — linking to it directly breaks the next day. Instead we fetch
// a FRESH signed URL on each click via GET /documents/:id/url.
//
// We open the tab synchronously on click (before the await) so popup blockers
// don't swallow it, then point that tab at the URL once it arrives.
export function DocumentDownloadButton({
  docId,
  fallbackUrl,
  label = 'Download',
}: {
  docId: string;
  fallbackUrl?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const win = window.open('about:blank', '_blank');
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/documents/${docId}/url`);
      const url: string | undefined = data?.data?.url ?? fallbackUrl ?? undefined;
      if (!url) {
        win?.close();
        toast.error('Could not generate a download link. Please try again.');
        return;
      }
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      if (fallbackUrl && win) {
        win.location.href = fallbackUrl;
      } else {
        win?.close();
        toast.error(err?.response?.data?.error ?? 'Download failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleDownload}>
      {label}
    </Button>
  );
}
