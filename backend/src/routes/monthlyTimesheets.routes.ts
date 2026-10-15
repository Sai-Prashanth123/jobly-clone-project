import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import {
  upsertMonthlyTimesheetSchema, updateMonthlyTimesheetSchema,
  patchMonthlyStatusSchema, listMonthlyTimesheetsQuerySchema, patchEntriesSchema,
  yearlyTimesheetPdfSchema,
} from '../schemas/monthlyTimesheet.schema';
import * as ctrl from '../controllers/monthlyTimesheets.controller';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('monthlyTimesheets.view', 'admin', 'hr', 'operations', 'employee'), validateQuery(listMonthlyTimesheetsQuerySchema), ctrl.list);
// Hydrate the fill-in page for the logged-in employee's chosen month.
router.get('/me', requirePermission('monthlyTimesheets.view.me', 'admin', 'hr', 'employee'), ctrl.getMyMonth);
// Approved/pending leave coverage for a month (before/after the sheet is saved).
router.get('/leave-check', requirePermission('monthlyTimesheets.view.leave-check', 'admin', 'hr', 'employee'), ctrl.leaveCheck);
// Active employees with no monthly timesheet for a given year/month (Attendance
// Review "Not Submitted" list). Must stay ahead of `/:id` below.
router.get('/not-submitted', requirePermission('monthlyTimesheets.view.not-submitted', 'admin', 'hr'), ctrl.getNotSubmitted);
// Combines a full year of already-assembled monthly data (same data the
// "Download Year (CSV)" export uses) into one PDF. Must stay ahead of `/:id`.
router.post('/yearly-pdf', requirePermission('monthlyTimesheets.create', 'admin', 'hr', 'operations', 'employee'), validateBody(yearlyTimesheetPdfSchema), ctrl.getYearlyPdf);
// Single-month Word doc rendered straight from already-assembled data (same
// shape as yearly-pdf, months[0] used) — no DB row needed just to preview.
router.post('/docx-from-data', requirePermission('monthlyTimesheets.create', 'admin', 'hr', 'operations', 'employee'), validateBody(yearlyTimesheetPdfSchema), ctrl.getDocxFromData);
router.post('/', requirePermission('monthlyTimesheets.create.root', 'admin', 'hr', 'employee'), validateBody(upsertMonthlyTimesheetSchema), ctrl.upsert);
router.get('/:id', requirePermission('monthlyTimesheets.view', 'admin', 'hr', 'operations', 'employee'), ctrl.getOne);
router.get('/:id/pdf', requirePermission('monthlyTimesheets.view', 'admin', 'hr', 'operations', 'employee'), ctrl.getPdf);
router.get('/:id/docx', requirePermission('monthlyTimesheets.view', 'admin', 'hr', 'operations', 'employee'), ctrl.getDocx);
router.put('/:id', requirePermission('monthlyTimesheets.edit', 'admin', 'hr', 'employee'), validateBody(updateMonthlyTimesheetSchema), ctrl.update);
// Employee submits their own; admin/HR may submit on an employee's behalf.
// Side-effects: notify manager + HR, email HR, PDF.
router.patch('/:id/submit', requirePermission('monthlyTimesheets.edit', 'admin', 'hr', 'employee'), ctrl.submit);
// Approve/Reject — route permits 'employee' so a reporting-manager employee can
// review; the service verifies the caller is the manager OR role ∈ {hr, admin}.
router.patch('/:id/status', requirePermission('monthlyTimesheets.edit', 'admin', 'hr', 'employee'), validateBody(patchMonthlyStatusSchema), ctrl.patchStatus);

// HR notes (admin/hr only — employee never sees nor edits these).
router.patch('/:id/hr-notes', requirePermission('monthlyTimesheets.edit.id-hr-notes', 'admin', 'hr'), ctrl.patchHrNotes);

// Admin/HR direct entry edit — skips status guard and closed-month guard.
router.patch('/:id/entries', requirePermission('monthlyTimesheets.edit.id-entries', 'admin', 'hr'), validateBody(patchEntriesSchema), ctrl.patchEntries);

// Client-signed timesheet proof — required at submit-time when total_hours > 0.
// Employee can only upload to their own timesheet (controller enforces).
router.post('/:id/client-proof', requirePermission('monthlyTimesheets.create.id-client-proof', 'admin', 'hr', 'employee'), documentUpload.single('file'), ctrl.uploadClientProof);
router.delete('/:id/client-proof', requirePermission('monthlyTimesheets.delete', 'admin', 'hr', 'employee'), ctrl.deleteClientProof);

export default router;
