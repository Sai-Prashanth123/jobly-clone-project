import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { supabaseAdmin } from '../config/supabase';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin', 'hr'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', action, entityType, entityId, actorId, search, startDate, endDate } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let q = supabaseAdmin
      .from('activity_logs')
      .select(`id, actor_id, action, entity_type, entity_id, entity_label, metadata, created_at, portal_users!actor_id(name, email, role)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (action) q = q.eq('action', action);
    if (entityType) q = q.eq('entity_type', entityType);
    if (entityId) q = q.eq('entity_id', entityId);
    if (actorId) q = q.eq('actor_id', actorId);
    if (startDate) q = q.gte('created_at', startDate);
    if (endDate) q = q.lte('created_at', endDate + 'T23:59:59Z');
    if (search) q = q.ilike('entity_label', `%${search}%`);

    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ success: true, data: data ?? [], total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (e) { next(e); }
});

export default router;
