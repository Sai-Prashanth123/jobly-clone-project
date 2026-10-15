import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as ctrl from '../controllers/reports.controller';

const router = Router();

router.use(authenticate);

// Operational reports (utilisation, visa expiry, missing timesheets, summary)
// include HR: visa expiry and missing timesheets are HR's own work, and the
// frontend already routed HR to this page - every panel just 403'd. Financial
// reports below stay admin/finance, and Reports.tsx hides that tab to match.

router.get('/employee-utilization', requirePermission('reports.view.employee-utilization', 'admin','finance','operations','hr'), ctrl.employeeUtilization);
router.get('/visa-expiry',          requirePermission('reports.view.visa-expiry', 'admin','finance','operations','hr'), ctrl.visaExpiry);
router.get('/missing-timesheets',   requirePermission('reports.view.missing-timesheets', 'admin','finance','operations','hr'), ctrl.missingTimesheets);
router.get('/timesheet-summary',    requirePermission('reports.view.timesheet-summary', 'admin','finance','operations','hr'), ctrl.timesheetSummary);
router.get('/financial-summary',    requirePermission('reports.view', 'admin','finance'),      ctrl.financialSummary);
router.get('/revenue-by-date-range', requirePermission('reports.view', 'admin','finance'), ctrl.revenueByDateRange);
router.get('/profitability',        requirePermission('reports.view', 'admin','finance'),      ctrl.profitability);
router.get('/billing-by-client',    requirePermission('reports.view', 'admin','finance'),      ctrl.billingByClient);
router.get('/profit-loss', requirePermission('reports.view', 'admin','finance'), ctrl.profitLoss);

export default router;
