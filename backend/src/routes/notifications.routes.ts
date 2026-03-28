import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as ctrl from '../controllers/notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/',                           ctrl.list);
router.get('/unread-count',               ctrl.unreadCount);
router.patch('/:id/read',                 ctrl.markRead);
router.patch('/read-all',                 ctrl.markAllRead);

// Admin-only trigger endpoints (can be called by cron or manually)
router.post('/trigger/timesheet-reminders', requireRole('admin'), ctrl.triggerTimesheetReminders);
router.post('/trigger/contract-expiry',     requireRole('admin'), ctrl.triggerContractExpiry);

export default router;
