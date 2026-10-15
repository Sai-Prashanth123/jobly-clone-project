import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '../../lib/apiClient';
import { triggerDownload } from '../../lib/download';

// Dependents live in a private bucket like every other document — fetch a
// fresh signed URL per click rather than trusting a stored one. Mirrors the
// same-named component in LegalReviewDetail.tsx (kept local there; this is
// the shared copy used by the newer Case Details Dependents/Children cards).
export function DependentPassportButton({ employeeId, dependentId }: { employeeId: string; dependentId: string }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/employees/${employeeId}/dependents/${dependentId}/passport-url`);
      const url: string | undefined = data?.url;
      if (!url) {
        toast.error('Could not generate a link. Please try again.');
        return;
      }
      triggerDownload(url);
    } catch {
      toast.error('Could not generate a link. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" loading={loading} onClick={handleClick}>
      View Passport
    </Button>
  );
}
