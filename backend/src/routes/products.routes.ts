import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody, validateQuery } from '../middleware/validate';
import { createProductSchema, updateProductSchema, listProductsQuerySchema } from '../schemas/product.schema';
import * as ctrl from '../controllers/products.controller';

const router = Router();

router.use(authenticate);

// Catalog is finance/admin-owned. Read is also allowed for the invoice builder.
router.get('/', requireRole('admin', 'finance'), validateQuery(listProductsQuerySchema), ctrl.list);
router.post('/', requireRole('admin', 'finance'), validateBody(createProductSchema), ctrl.create);
router.put('/:id', requireRole('admin', 'finance'), validateBody(updateProductSchema), ctrl.update);
router.delete('/:id', requireRole('admin', 'finance'), ctrl.remove);

export default router;
