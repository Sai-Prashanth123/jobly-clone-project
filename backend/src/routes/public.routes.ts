import { Router } from 'express';
import * as invoiceCtrl from '../controllers/invoices.controller';
import * as contactCtrl from '../controllers/contact.controller';
import { validateBody } from '../middleware/validate';
import { contactLimiter } from '../middleware/rateLimiter';
import { contactSchema } from '../schemas/contact.schema';

// PUBLIC routes — no authentication. Mounted at /api/v1/public. Access is
// gated by the unguessable per-invoice public_token (a UUID), like Wave's
// shareable invoice links.
const router = Router();

router.get('/invoices/:token', invoiceCtrl.getPublic);

// Landing-page "Contact Us" form → emails info@joblysolutions.com. Rate-limited
// + honeypot-protected since it's unauthenticated.
router.post('/contact', contactLimiter, validateBody(contactSchema), contactCtrl.submit);

export default router;
