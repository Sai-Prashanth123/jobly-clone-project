import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '../../lib/apiClient';
import { triggerDownload } from '../../lib/download';

// Documents live in a PRIVATE bucket (they hold SSNs, W-9s, bank letters), so
// their URLs are short-lived signed URLs. The URL saved at upload time expires
// after ~1 hour — linking to it directly breaks the next day. Instead we fetch
// a FRESH signed URL on each click via GET /documents/:id/url.
//
// The URL is signed with Content-Disposition: attachment, so an anchor click
// saves the file without navigating and without a tab — see triggerDownload.
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
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/documents/${docId}/url`);
      const url: string | undefined = data?.data?.url ?? fallbackUrl ?? undefined;
      if (!url) {
        toast.error('Could not generate a download link. Please try again.');
        return;
      }
      triggerDownload(url);
    } catch (err: any) {
      // Raw apiClient call, not a useMutation — apiClient's interceptor only
      // handles auth/idle redirects, it never toasts, so this needs its own.
      toast.error(err?.response?.data?.error ?? 'Could not generate a download link. Please try again.');
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
