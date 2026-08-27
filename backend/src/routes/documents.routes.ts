import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { documentUpload } from '../middleware/upload';
import { legalReviewSchema } from '../schemas/documents.schema';
import * as ctrl from '../controllers/documents.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.post('/upload', requireRole('admin', 'hr', 'operations'), upload.single('file'), ctrl.upload);
router.get('/:id/url', ctrl.getSignedUrl);
router.get('/:id/preview-url', requireRole('admin', 'hr', 'operations', 'finance', 'employee', 'legal'), ctrl.getPreviewUrl);
router.get('/:id/render', requireRole('admin', 'hr', 'operations', 'finance', 'employee', 'legal'), ctrl.renderDocument);
router.delete('/:id', requireRole('admin', 'hr', 'operations'), ctrl.remove);
// Legal marks a document reviewed/flagged for HR's attention, with an
// optional note — legal never edits/deletes the document itself, just this
// review metadata.
router.patch('/:id/legal-review', requireRole('admin', 'legal'), validateBody(legalReviewSchema), ctrl.setLegalReview);

export default router;
