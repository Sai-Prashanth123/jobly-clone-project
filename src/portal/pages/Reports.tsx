import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '../components/shared/PageHeader';
import { ActiveEmployeesReport } from '../components/reports/ActiveEmployeesReport';
import { UtilizationChart } from '../components/reports/UtilizationChart';
import { EmployeeAssignmentReport } from '../components/reports/EmployeeAssignmentReport';
import { VisaExpiryReport } from '../components/reports/VisaExpiryReport';
import { ClientBillingSummary } from '../components/reports/ClientBillingSummary';
import { BillingChart } from '../components/reports/BillingChart';
import { ActiveClientsTable } from '../components/reports/ActiveClientsTable';
import { MissingTimesheetsReport } from '../components/reports/MissingTimesheetsReport';
import { ApprovedTimesheetsReport } from '../components/reports/ApprovedTimesheetsReport';
import { TimesheetSummaryTable } from '../components/reports/TimesheetSummaryTable';
import { MonthlyRevenueReport } from '../components/reports/MonthlyRevenueReport';
import { OutstandingInvoicesReport } from '../components/reports/OutstandingInvoicesReport';
import { PaymentsReceivedReport } from '../components/reports/PaymentsReceivedReport';
import { ProfitabilityReport } from '../components/reports/ProfitabilityReport';

export default function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Business intelligence across employees, clients, timesheets, and financials"
      />

      <Tabs defaultValue="employees">
        <TabsList className="mb-6 grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* ── EMPLOYEE REPORTS ───────────────────────────────────────────── */}
        <TabsContent value="employees">
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Active Employees
              </h2>
              <ActiveEmployeesReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Employee Utilization
              </h2>
              <UtilizationChart />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Employee Assignment Report
              </h2>
              <EmployeeAssignmentReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Visa Expiry Report
              </h2>
              <VisaExpiryReport />
            </section>
          </div>
        </TabsContent>

        {/* ── CLIENT REPORTS ─────────────────────────────────────────────── */}
        <TabsContent value="clients">
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Client Billing Summary
              </h2>
              <ClientBillingSummary />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Revenue by Client
              </h2>
              <BillingChart />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Active Clients
              </h2>
              <ActiveClientsTable />
            </section>
          </div>
        </TabsContent>

        {/* ── TIMESHEET REPORTS ──────────────────────────────────────────── */}
        <TabsContent value="timesheets">
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Missing Timesheets
              </h2>
              <MissingTimesheetsReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Approved Timesheets
              </h2>
              <ApprovedTimesheetsReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Timesheet Summary
              </h2>
              <TimesheetSummaryTable />
            </section>
          </div>
        </TabsContent>

        {/* ── FINANCIAL REPORTS ──────────────────────────────────────────── */}
        <TabsContent value="financial">
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Monthly Revenue
              </h2>
              <MonthlyRevenueReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Outstanding Invoices
              </h2>
              <OutstandingInvoicesReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Payments Received
              </h2>
              <PaymentsReceivedReport />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Profitability Report
              </h2>
              <ProfitabilityReport />
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
