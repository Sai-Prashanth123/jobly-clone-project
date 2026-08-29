import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import {
  createCaseSchema, updateCaseSchema, listCasesQuerySchema,
  createFilingSchema, updateFilingSchema, createNoteSchema, updateNoteSchema,
} from '../schemas/case.schema';
import { upsertWageSchema, upsertTaxReturnSchema } from '../schemas/caseWages.schema';
import { upsertPermDetailsSchema } from '../schemas/casePerm.schema';
import * as ctrl from '../controllers/cases.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

// Cases (and their filings/notes) are Legal's own work product — admin can
// see everything in the system, legal manages it directly. No other role.
router.get('/', requireRole('admin', 'legal'), validateQuery(listCasesQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'legal'), validateBody(createCaseSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'legal'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'legal'), validateBody(updateCaseSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'legal'), ctrl.remove);

router.post('/:id/filings', requireRole('admin', 'legal'), validateBody(createFilingSchema), ctrl.createFiling);
router.put('/:id/filings/:filingId', requireRole('admin', 'legal'), validateBody(updateFilingSchema), ctrl.updateFiling);
router.delete('/:id/filings/:filingId', requireRole('admin', 'legal'), ctrl.removeFiling);

router.post('/:id/notes', requireRole('admin', 'legal'), validateBody(createNoteSchema), ctrl.createNote);
router.put('/:id/notes/:noteId', requireRole('admin', 'legal'), validateBody(updateNoteSchema), ctrl.updateNote);
router.delete('/:id/notes/:noteId', requireRole('admin', 'legal'), ctrl.removeNote);

router.get('/:id/documents', requireRole('admin', 'legal'), ctrl.listDocuments);
router.post('/:id/documents', requireRole('admin', 'legal'), upload.single('file'), ctrl.uploadDocument);
router.delete('/:id/documents/:docId', requireRole('admin', 'legal'), ctrl.removeDocument);

router.get('/:id/wages', requireRole('admin', 'legal'), ctrl.listWages);
router.put('/:id/wages', requireRole('admin', 'legal'), validateBody(upsertWageSchema), ctrl.upsertWage);
router.get('/:id/tax-returns', requireRole('admin', 'legal'), ctrl.listTaxReturns);
router.put('/:id/tax-returns', requireRole('admin', 'legal'), validateBody(upsertTaxReturnSchema), ctrl.upsertTaxReturn);
router.get('/:id/perm', requireRole('admin', 'legal'), ctrl.getPermDetails);
router.put('/:id/perm', requireRole('admin', 'legal'), validateBody(upsertPermDetailsSchema), ctrl.upsertPermDetails);

export default router;
