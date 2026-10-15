import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { legalReviewSchema } from '../schemas/documents.schema';
import * as ctrl from '../controllers/documents.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.post('/upload', requirePermission('documents.create', 'admin', 'hr', 'operations'), upload.single('file'), ctrl.upload);
router.get('/:id/url', requirePermission('documents.view', 'admin', 'hr', 'operations', 'finance', 'employee', 'legal'), ctrl.getSignedUrl);
router.get('/:id/preview-url', requirePermission('documents.view', 'admin', 'hr', 'operations', 'finance', 'employee', 'legal'), ctrl.getPreviewUrl);
router.get('/:id/render', requirePermission('documents.view', 'admin', 'hr', 'operations', 'finance', 'employee', 'legal'), ctrl.renderDocument);
router.delete('/:id', requirePermission('documents.delete', 'admin', 'hr', 'operations'), ctrl.remove);
// Legal marks a document reviewed/flagged for HR's attention, with an
// optional note — legal never edits/deletes the document itself, just this
// review metadata.
router.patch('/:id/legal-review', requirePermission('documents.edit', 'admin', 'legal'), validateBody(legalReviewSchema), ctrl.setLegalReview);

export default router;
