import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import {
  upsertMonthlyTimesheetSchema, updateMonthlyTimesheetSchema,
  patchMonthlyStatusSchema, listMonthlyTimesheetsQuerySchema, patchEntriesSchema,
} from '../schemas/monthlyTimesheet.schema';
import * as ctrl from '../controllers/monthlyTimesheets.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin', 'hr', 'operations', 'employee'), validateQuery(listMonthlyTimesheetsQuerySchema), ctrl.list);
// Hydrate the fill-in page for the logged-in employee's chosen month.
router.get('/me', requireRole('admin', 'hr', 'employee'), ctrl.getMyMonth);
// Approved/pending leave coverage for a month (before/after the sheet is saved).
router.get('/leave-check', requireRole('admin', 'hr', 'employee'), ctrl.leaveCheck);
// Active employees with no monthly timesheet for a given year/month (Attendance
// Review "Not Submitted" list). Must stay ahead of `/:id` below.
router.get('/not-submitted', requireRole('admin', 'hr'), ctrl.getNotSubmitted);
router.post('/', requireRole('admin', 'hr', 'employee'), validateBody(upsertMonthlyTimesheetSchema), ctrl.upsert);
router.get('/:id', requireRole('admin', 'hr', 'operations', 'employee'), ctrl.getOne);
router.get('/:id/pdf', requireRole('admin', 'hr', 'operations', 'employee'), ctrl.getPdf);
router.get('/:id/docx', requireRole('admin', 'hr', 'operations', 'employee'), ctrl.getDocx);
router.put('/:id', requireRole('admin', 'hr', 'employee'), validateBody(updateMonthlyTimesheetSchema), ctrl.update);
// Employee submits their own; admin/HR may submit on an employee's behalf.
// Side-effects: notify manager + HR, email HR, PDF.
router.patch('/:id/submit', requireRole('admin', 'hr', 'employee'), ctrl.submit);
// Approve/Reject — route permits 'employee' so a reporting-manager employee can
// review; the service verifies the caller is the manager OR role ∈ {hr, admin}.
router.patch('/:id/status', requireRole('admin', 'hr', 'employee'), validateBody(patchMonthlyStatusSchema), ctrl.patchStatus);

// HR notes (admin/hr only — employee never sees nor edits these).
router.patch('/:id/hr-notes', requireRole('admin', 'hr'), ctrl.patchHrNotes);

// Admin/HR direct entry edit — skips status guard and closed-month guard.
router.patch('/:id/entries', requireRole('admin', 'hr'), validateBody(patchEntriesSchema), ctrl.patchEntries);

// Client-signed timesheet proof — required at submit-time when total_hours > 0.
// Employee can only upload to their own timesheet (controller enforces).
router.post('/:id/client-proof', requireRole('admin', 'hr', 'employee'), documentUpload.single('file'), ctrl.uploadClientProof);
router.delete('/:id/client-proof', requireRole('admin', 'hr', 'employee'), ctrl.deleteClientProof);

export default router;
