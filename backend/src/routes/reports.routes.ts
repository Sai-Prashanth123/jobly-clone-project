import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as ctrl from '../controllers/reports.controller';

const router = Router();

router.use(authenticate);

router.get('/employee-utilization', requireRole('admin','finance','operations'), ctrl.employeeUtilization);
router.get('/visa-expiry',          requireRole('admin','finance','operations'), ctrl.visaExpiry);
router.get('/missing-timesheets',   requireRole('admin','finance','operations'), ctrl.missingTimesheets);
router.get('/timesheet-summary',    requireRole('admin','finance','operations'), ctrl.timesheetSummary);
router.get('/financial-summary',    requireRole('admin','finance','operations'),      ctrl.financialSummary);
router.get('/profitability',        requireRole('admin','finance','operations'),      ctrl.profitability);
router.get('/billing-by-client',    requireRole('admin','finance','operations'),      ctrl.billingByClient);

export default router;
