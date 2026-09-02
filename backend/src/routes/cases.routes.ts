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
import { createCaseMessageSchema } from '../schemas/caseMessage.schema';
import * as ctrl from '../controllers/cases.controller';
import * as messagesCtrl from '../controllers/caseMessages.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

// Cases (and their filings/notes/etc) are worked by Legal, with HR/admin
// having the same level of access — HR already sees broader employee data
// elsewhere in this app than Legal's redacted view, so this isn't a wider
// PII exposure than HR already has.
router.get('/', requireRole('admin', 'hr', 'legal'), validateQuery(listCasesQuerySchema), ctrl.list);
// Case creation is admin/hr only — Legal works cases already raised to it,
// it doesn't open its own.
router.post('/', requireRole('admin', 'hr'), validateBody(createCaseSchema), ctrl.create);
// Must come before /:id so "taggable-users" isn't captured as a case id.
router.get('/taggable-users', requireRole('admin', 'hr', 'legal'), ctrl.listTaggableUsers);
router.get('/:id', requireRole('admin', 'hr', 'legal'), ctrl.getOne);
router.put('/:id', requireRole('admin', 'hr', 'legal'), validateBody(updateCaseSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'hr', 'legal'), ctrl.remove);

router.post('/:id/filings', requireRole('admin', 'hr', 'legal'), validateBody(createFilingSchema), ctrl.createFiling);
router.put('/:id/filings/:filingId', requireRole('admin', 'hr', 'legal'), validateBody(updateFilingSchema), ctrl.updateFiling);
router.delete('/:id/filings/:filingId', requireRole('admin', 'hr', 'legal'), ctrl.removeFiling);

router.post('/:id/notes', requireRole('admin', 'hr', 'legal'), validateBody(createNoteSchema), ctrl.createNote);
router.put('/:id/notes/:noteId', requireRole('admin', 'hr', 'legal'), validateBody(updateNoteSchema), ctrl.updateNote);
router.delete('/:id/notes/:noteId', requireRole('admin', 'hr', 'legal'), ctrl.removeNote);

router.get('/:id/documents', requireRole('admin', 'hr', 'legal'), ctrl.listDocuments);
router.post('/:id/documents', requireRole('admin', 'hr', 'legal'), upload.single('file'), ctrl.uploadDocument);
router.delete('/:id/documents/:docId', requireRole('admin', 'hr', 'legal'), ctrl.removeDocument);

router.get('/:id/wages', requireRole('admin', 'hr', 'legal'), ctrl.listWages);
router.put('/:id/wages', requireRole('admin', 'hr', 'legal'), validateBody(upsertWageSchema), ctrl.upsertWage);
router.get('/:id/tax-returns', requireRole('admin', 'hr', 'legal'), ctrl.listTaxReturns);
router.put('/:id/tax-returns', requireRole('admin', 'hr', 'legal'), validateBody(upsertTaxReturnSchema), ctrl.upsertTaxReturn);
router.get('/:id/perm', requireRole('admin', 'hr', 'legal'), ctrl.getPermDetails);
router.put('/:id/perm', requireRole('admin', 'hr', 'legal'), validateBody(upsertPermDetailsSchema), ctrl.upsertPermDetails);

router.post('/:id/status-steps/:stepKey/complete', requireRole('admin', 'hr', 'legal'), ctrl.completeStatusStep);

// An employee may also reach these three — scoped to their OWN case only,
// enforced inside caseMessages.service.ts (never widened here, since /:id and
// every other case sub-resource above stays admin/hr/legal-only).
router.get('/:id/messages', requireRole('admin', 'hr', 'legal', 'employee'), messagesCtrl.list);
router.post('/:id/messages', requireRole('admin', 'hr', 'legal', 'employee'), validateBody(createCaseMessageSchema), messagesCtrl.create);
router.post('/:id/messages/:messageId/read', requireRole('admin', 'hr', 'legal', 'employee'), messagesCtrl.markRead);

export default router;
