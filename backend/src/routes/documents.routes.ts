import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { documentUpload } from '../middleware/upload';
import * as ctrl from '../controllers/documents.controller';

const router = Router();
const upload = documentUpload;

router.use(authenticate);

router.post('/upload', requireRole('admin', 'hr', 'operations'), upload.single('file'), ctrl.upload);
router.get('/:id/url', ctrl.getSignedUrl);
router.get('/:id/preview-url', requireRole('admin', 'hr', 'operations', 'finance', 'employee'), ctrl.getPreviewUrl);
router.delete('/:id', requireRole('admin', 'hr', 'operations'), ctrl.remove);

export default router;
