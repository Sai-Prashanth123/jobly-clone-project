import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '../components/shared/PageHeader';
import { UtilizationChart } from '../components/reports/UtilizationChart';
import { BillingChart } from '../components/reports/BillingChart';
import { TimesheetSummaryTable } from '../components/reports/TimesheetSummaryTable';
import { FinancialChart } from '../components/reports/FinancialChart';

export default function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Analytics and business intelligence"
      />

      <Tabs defaultValue="utilization">
        <TabsList className="mb-6">
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="utilization">
          <div className="space-y-6">
            <UtilizationChart />
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6">
            <BillingChart />
          </div>
        </TabsContent>

        <TabsContent value="timesheets">
          <div className="space-y-6">
            <TimesheetSummaryTable />
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <div className="space-y-6">
            <FinancialChart />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
