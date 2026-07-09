import { Loader2, Star, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../components/shared/PageHeader';
import { EmptyState } from '../components/shared/EmptyState';
import { usePerformanceReviews, useGeneratePerformanceReviewPdf } from '../hooks/usePerformanceReviews';
import { formatDateUS } from '../lib/utils';
import { toast } from 'sonner';

export default function MyPerformanceReviews() {
  const { data, isLoading } = usePerformanceReviews({ status: 'sent' });
  const generatePdf = useGeneratePerformanceReviewPdf();

  const reviews = data?.data ?? [];

  const handleDownload = async (id: string) => {
    try {
      const url = await generatePdf.mutateAsync(id);
      window.open(url, '_blank');
    } catch {
      toast.error('Could not open this review');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Performance" title="My Reviews" description={isLoading ? 'Loading…' : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="No reviews yet" description="Performance reviews sent to you will appear here." />
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-sm text-gray-900">{formatDateUS(r.periodStart)} – {formatDateUS(r.periodEnd)}</p>
                  <p className="text-xs text-muted-foreground">{r.displayId}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownload(r.id)} disabled={generatePdf.isPending}>
                  {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
