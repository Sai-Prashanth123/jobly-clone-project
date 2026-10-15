import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from '../schemas/announcements.schema';
import * as ctrl from '../controllers/announcements.controller';

const router = Router();

router.use(authenticate);

router.get('/',             requirePermission('announcements.view', 'admin','hr','operations','finance','employee','legal'), validateQuery(listAnnouncementsQuerySchema), ctrl.list);
router.post('/',            requirePermission('announcements.manage', 'admin','hr'),                                   validateBody(createAnnouncementSchema),       ctrl.create);
router.get('/unread-count', requirePermission('announcements.view', 'admin','hr','operations','finance','employee','legal'),                                               ctrl.getUnreadCount);
router.post('/mark-seen',   requirePermission('announcements.create.mark-seen', 'admin','hr','operations','finance','employee','legal'),                                               ctrl.markSeen);
router.get('/:id',          requirePermission('announcements.view', 'admin','hr','operations','finance','employee','legal'),                                               ctrl.getOne);
router.put('/:id',          requirePermission('announcements.manage', 'admin','hr'),                                   validateBody(updateAnnouncementSchema),       ctrl.update);
router.delete('/:id',       requirePermission('announcements.manage', 'admin','hr'),                                                                                ctrl.remove);

export default router;
