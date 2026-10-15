import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as ctrl from '../controllers/notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/',                           ctrl.list);
router.get('/counts',                     ctrl.counts);
router.patch('/:id/read',                 ctrl.markRead);
router.patch('/read-all',                 ctrl.markAllRead);

// Admin-only trigger endpoints (can be called by cron or manually)
router.post('/trigger/timesheet-reminders', requirePermission('notifications.manage', 'admin'), ctrl.triggerTimesheetReminders);
router.post('/trigger/contract-expiry',     requirePermission('notifications.manage', 'admin'), ctrl.triggerContractExpiry);
router.post('/trigger/invoice-ready',       requirePermission('notifications.manage', 'admin'), ctrl.triggerInvoiceReadiness);
router.post('/trigger/document-expiry',     requirePermission('notifications.manage', 'admin'), ctrl.triggerDocumentExpiry);

export default router;
