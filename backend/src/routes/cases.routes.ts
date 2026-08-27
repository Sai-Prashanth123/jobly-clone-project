import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createCaseSchema, updateCaseSchema, listCasesQuerySchema,
  createFilingSchema, updateFilingSchema, createNoteSchema, updateNoteSchema,
} from '../schemas/case.schema';
import * as ctrl from '../controllers/cases.controller';

const router = Router();

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

export default router;
