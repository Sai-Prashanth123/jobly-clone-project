import { Router } from 'express';
import * as invoiceCtrl from '../controllers/invoices.controller';

// PUBLIC routes — no authentication. Mounted at /api/v1/public. Access is
// gated by the unguessable per-invoice public_token (a UUID), like Wave's
// shareable invoice links.
const router = Router();

router.get('/invoices/:token', invoiceCtrl.getPublic);

export default router;
