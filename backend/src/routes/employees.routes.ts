import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema } from '../schemas/employee.schema';
import * as ctrl from '../controllers/employees.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', requireRole('admin','hr','operations','finance','employee'), validateQuery(listEmployeesQuerySchema), ctrl.list);
router.post('/', requireRole('admin','hr'), validateBody(createEmployeeSchema), ctrl.create);
router.get('/export', requireRole('admin', 'hr', 'operations'), ctrl.exportEmployees);
router.get('/:id', requireRole('admin','hr','operations','finance','employee'), ctrl.getOne);
router.put('/:id', requireRole('admin','hr'), validateBody(updateEmployeeSchema), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

router.get('/:id/assignments', requireRole('admin','hr','operations'), ctrl.assignments);
router.get('/:id/timesheets', requireRole('admin','hr','operations'), ctrl.timesheets);
router.post('/:id/documents', requireRole('admin','hr'), upload.single('file'), ctrl.uploadDoc);
router.delete('/:id/documents/:docId', requireRole('admin','hr'), ctrl.deleteDoc);

export default router;
