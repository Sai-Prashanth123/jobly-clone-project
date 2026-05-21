import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema } from '../schemas/employee.schema';
import * as ctrl from '../controllers/employees.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.get('/', requireRole('admin','hr','operations','finance','employee'), validateQuery(listEmployeesQuerySchema), ctrl.list);
router.post('/', requireRole('admin','hr'), validateBody(createEmployeeSchema), ctrl.create);
router.get('/export', requireRole('admin', 'hr', 'operations'), ctrl.exportEmployees);
router.get('/:id', requireRole('admin','hr','operations','finance','employee'), ctrl.getOne);
// 'employee' is allowed so a user can edit their own profile; the controller
// enforces that an employee may only update their OWN record (ownership check).
router.put('/:id', requireRole('admin','hr','employee'), validateBody(updateEmployeeSchema), ctrl.update);
router.delete('/:id', requireRole('admin','hr'), ctrl.remove);
router.post('/:id/resend-credentials', requireRole('admin','hr'), ctrl.resendCredentials);

router.get('/:id/assignments', requireRole('admin','hr','operations'), ctrl.assignments);
router.get('/:id/timesheets', requireRole('admin','hr','operations'), ctrl.timesheets);
router.post('/:id/photo', requireRole('admin','hr','employee'), upload.single('file'), ctrl.uploadPhoto);
router.post('/:id/documents', requireRole('admin','hr','employee'), upload.single('file'), ctrl.uploadDoc);
router.delete('/:id/documents/:docId', requireRole('admin','hr','employee'), ctrl.deleteDoc);

export default router;
