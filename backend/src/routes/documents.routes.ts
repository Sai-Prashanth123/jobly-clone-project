import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as ctrl from '../controllers/documents.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.post('/upload', upload.single('file'), ctrl.upload);
router.get('/:id/url', ctrl.getSignedUrl);
router.delete('/:id', requireRole('admin', 'hr', 'operations'), ctrl.remove);

export default router;
