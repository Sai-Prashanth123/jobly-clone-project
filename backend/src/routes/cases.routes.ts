import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
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
router.get('/', requirePermission('cases.view', 'admin', 'hr', 'legal'), validateQuery(listCasesQuerySchema), ctrl.list);
// Case creation is admin/hr only — Legal works cases already raised to it,
// it doesn't open its own.
router.post('/', requirePermission('cases.create.root', 'admin', 'hr'), validateBody(createCaseSchema), ctrl.create);
// Must come before /:id so "taggable-users" isn't captured as a case id.
router.get('/taggable-users', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.listTaggableUsers);
router.get('/:id', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.getOne);
router.put('/:id', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(updateCaseSchema), ctrl.update);
router.delete('/:id', requirePermission('cases.manage', 'admin', 'hr', 'legal'), ctrl.remove);

router.post('/:id/filings', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(createFilingSchema), ctrl.createFiling);
router.put('/:id/filings/:filingId', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(updateFilingSchema), ctrl.updateFiling);
router.delete('/:id/filings/:filingId', requirePermission('cases.manage', 'admin', 'hr', 'legal'), ctrl.removeFiling);

router.post('/:id/notes', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(createNoteSchema), ctrl.createNote);
router.put('/:id/notes/:noteId', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(updateNoteSchema), ctrl.updateNote);
router.delete('/:id/notes/:noteId', requirePermission('cases.manage', 'admin', 'hr', 'legal'), ctrl.removeNote);

router.get('/:id/documents', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.listDocuments);
router.post('/:id/documents', requirePermission('cases.manage', 'admin', 'hr', 'legal'), upload.single('file'), ctrl.uploadDocument);
router.delete('/:id/documents/:docId', requirePermission('cases.manage', 'admin', 'hr', 'legal'), ctrl.removeDocument);

router.get('/:id/wages', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.listWages);
router.put('/:id/wages', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(upsertWageSchema), ctrl.upsertWage);
router.get('/:id/tax-returns', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.listTaxReturns);
router.put('/:id/tax-returns', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(upsertTaxReturnSchema), ctrl.upsertTaxReturn);
router.get('/:id/perm', requirePermission('cases.view', 'admin', 'hr', 'legal'), ctrl.getPermDetails);
router.put('/:id/perm', requirePermission('cases.manage', 'admin', 'hr', 'legal'), validateBody(upsertPermDetailsSchema), ctrl.upsertPermDetails);

router.post('/:id/status-steps/:stepKey/complete', requirePermission('cases.manage', 'admin', 'hr', 'legal'), ctrl.completeStatusStep);

// An employee may also reach these three — scoped to their OWN case only,
// enforced inside caseMessages.service.ts (never widened here, since /:id and
// every other case sub-resource above stays admin/hr/legal-only).
router.get('/:id/messages', requirePermission('cases.view.id-messages', 'admin', 'hr', 'legal', 'employee'), messagesCtrl.list);
router.post('/:id/messages', requirePermission('cases.create.id-messages', 'admin', 'hr', 'legal', 'employee'), validateBody(createCaseMessageSchema), messagesCtrl.create);
router.post('/:id/messages/:messageId/read', requirePermission('cases.create.id-messages-messageId-read', 'admin', 'hr', 'legal', 'employee'), messagesCtrl.markRead);

export default router;
