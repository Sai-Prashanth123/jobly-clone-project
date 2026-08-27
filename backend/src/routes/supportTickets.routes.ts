import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createTicketSchema, resolveTicketSchema, listTicketsQuerySchema } from '../schemas/supportTicket.schema';
import * as ctrl from '../controllers/supportTickets.controller';

const router = Router();

router.use(authenticate);

// HR/Admin ask Legal a question about a case/employee; Legal (+Admin) answer
// and resolve it. Service-layer scoping restricts HR to only their own
// tickets — see supportTickets.service.ts's listTickets/getTicket.
router.get('/', requireRole('admin', 'hr', 'legal'), validateQuery(listTicketsQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'hr', 'legal'), validateBody(createTicketSchema), ctrl.create);
router.get('/:id', requireRole('admin', 'hr', 'legal'), ctrl.getOne);
router.patch('/:id/resolve', requireRole('admin', 'legal'), validateBody(resolveTicketSchema), ctrl.resolve);

export default router;
