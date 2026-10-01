import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as ctrl from '../controllers/reports.controller';

const router = Router();

router.use(authenticate);

// Operational reports (utilisation, visa expiry, missing timesheets, summary)
// include HR: visa expiry and missing timesheets are HR's own work, and the
// frontend already routed HR to this page - every panel just 403'd. Financial
// reports below stay admin/finance, and Reports.tsx hides that tab to match.

router.get('/employee-utilization', requireRole('admin','finance','operations','hr'), ctrl.employeeUtilization);
router.get('/visa-expiry',          requireRole('admin','finance','operations','hr'), ctrl.visaExpiry);
router.get('/missing-timesheets',   requireRole('admin','finance','operations','hr'), ctrl.missingTimesheets);
router.get('/timesheet-summary',    requireRole('admin','finance','operations','hr'), ctrl.timesheetSummary);
router.get('/financial-summary',    requireRole('admin','finance'),      ctrl.financialSummary);
router.get('/revenue-by-date-range', requireRole('admin','finance'), ctrl.revenueByDateRange);
router.get('/profitability',        requireRole('admin','finance'),      ctrl.profitability);
router.get('/billing-by-client',    requireRole('admin','finance'),      ctrl.billingByClient);
router.get('/profit-loss', requireRole('admin','finance'), ctrl.profitLoss);

export default router;
