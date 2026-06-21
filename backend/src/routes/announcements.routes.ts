import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from '../schemas/announcements.schema';
import * as ctrl from '../controllers/announcements.controller';

const router = Router();

router.use(authenticate);

router.get('/',     requireRole('admin','hr','operations','finance','employee'), validateQuery(listAnnouncementsQuerySchema), ctrl.list);
router.post('/',    requireRole('admin','hr'),                                   validateBody(createAnnouncementSchema),       ctrl.create);
router.get('/:id',  requireRole('admin','hr','operations','finance','employee'),                                               ctrl.getOne);
router.put('/:id',  requireRole('admin','hr'),                                   validateBody(updateAnnouncementSchema),       ctrl.update);
router.delete('/:id', requireRole('admin','hr'),                                                                              ctrl.remove);

export default router;
