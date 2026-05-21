import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  upsertMonthlyTimesheetSchema, updateMonthlyTimesheetSchema,
  patchMonthlyStatusSchema, listMonthlyTimesheetsQuerySchema,
} from '../schemas/monthlyTimesheet.schema';
import * as ctrl from '../controllers/monthlyTimesheets.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('admin', 'hr', 'operations', 'employee'), validateQuery(listMonthlyTimesheetsQuerySchema), ctrl.list);
// Hydrate the fill-in page for the logged-in employee's chosen month.
router.get('/me', requireRole('admin', 'hr', 'employee'), ctrl.getMyMonth);
router.post('/', requireRole('admin', 'hr', 'employee'), validateBody(upsertMonthlyTimesheetSchema), ctrl.upsert);
router.get('/:id', requireRole('admin', 'hr', 'operations', 'employee'), ctrl.getOne);
router.get('/:id/pdf', requireRole('admin', 'hr', 'operations', 'employee'), ctrl.getPdf);
router.put('/:id', requireRole('admin', 'hr', 'employee'), validateBody(updateMonthlyTimesheetSchema), ctrl.update);
// Employee submits their own; admin/HR may submit on an employee's behalf.
// Side-effects: notify manager + HR, email HR, PDF.
router.patch('/:id/submit', requireRole('admin', 'hr', 'employee'), ctrl.submit);
// Approve/Reject — route permits 'employee' so a reporting-manager employee can
// review; the service verifies the caller is the manager OR role ∈ {hr, admin}.
router.patch('/:id/status', requireRole('admin', 'hr', 'employee'), validateBody(patchMonthlyStatusSchema), ctrl.patchStatus);

export default router;
