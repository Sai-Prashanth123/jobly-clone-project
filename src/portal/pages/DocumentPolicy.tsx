import { FileCheck } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { DocumentPolicyMatrix } from '../components/admin/DocumentPolicyMatrix';

/**
 * Which documents each work status is asked for.
 *
 * Its own page rather than a tab inside Admin Settings, because Admin Settings
 * is admin-only and HR is exactly who should be editing this — they file these
 * documents daily and spot a missing requirement first. Putting it there would
 * have granted HR the permission and then hidden the screen from them.
 *
 * Sits beside Document Gaps on purpose: that page shows which categories look
 * wrong, this one is where they get fixed.
 */
export default function DocumentPolicy() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Document Policy"
        description="What each work status is asked to provide. Changes take effect on the next onboarding form — no deploy, no developer."
      />
      <Card>
        <CardContent className="pt-5">
          <DocumentPolicyMatrix />
        </CardContent>
      </Card>
    </div>
  );
}
