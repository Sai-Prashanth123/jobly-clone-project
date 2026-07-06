import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createTimesheetSchema, updateTimesheetSchema, patchTimesheetStatusSchema, reopenTimesheetSchema, listTimesheetsQuerySchema } from '../schemas/timesheet.schema';
import * as ctrl from '../controllers/timesheets.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin','hr','operations','employee','finance'), validateQuery(listTimesheetsQuerySchema), ctrl.list);
router.post('/', requireRole('admin','operations','employee'), validateBody(createTimesheetSchema), ctrl.create);
router.get('/export', requireRole('admin', 'hr', 'operations', 'finance'), ctrl.exportTimesheets);
// Per-day hours already logged on weekly timesheets overlapping a calendar
// month, used to auto-fill a brand-new monthly attendance timesheet. Must be
// registered before /:id so the literal path isn't swallowed as an id param.
router.get('/weekly-hours-for-month', requireRole('admin','hr','operations','employee','finance'), ctrl.weeklyHoursForMonth);
router.patch('/bulk-status', requireRole('admin', 'operations', 'finance', 'hr'), ctrl.bulkTimesheetStatus);
router.get('/:id', requireRole('admin','hr','operations','employee','finance'), ctrl.getOne);
router.get('/:id/leave-check', requireRole('admin','hr','operations','employee','finance'), ctrl.leaveCheck);
router.put('/:id', requireRole('admin','operations','employee'), validateBody(updateTimesheetSchema), ctrl.update);
router.patch('/:id/status', requireRole('admin','hr','operations','employee','finance'), validateBody(patchTimesheetStatusSchema), ctrl.patchStatus);
// Reopen an approved timesheet (manager_approved/client_approved -> draft) so
// the employee can correct their actual hours and resubmit.
router.patch('/:id/reopen', requireRole('admin','hr','operations'), validateBody(reopenTimesheetSchema), ctrl.reopen);
router.delete('/:id', requireRole('admin','operations','employee'), ctrl.remove);

// HR notes (admin/hr only — employee never sees nor edits these).
router.patch('/:id/hr-notes', requireRole('admin', 'hr'), ctrl.patchHrNotes);

// Client-signed timesheet proof (PDF / image / DOC). Required at submit-time
// when total_hours > 0; skipped when zero-hour (leave). Employee can only
// upload to their own timesheet (controller enforces ownership).
router.post('/:id/client-proof', requireRole('admin','operations','employee'), documentUpload.single('file'), ctrl.uploadClientProof);
router.delete('/:id/client-proof', requireRole('admin','operations','employee'), ctrl.deleteClientProof);

export default router;
