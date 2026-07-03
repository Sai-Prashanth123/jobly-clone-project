import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createSkillSchema, updateSkillSchema } from '../schemas/skills.schema';
import * as svc from '../services/skills.service';

const router = Router();
router.use(authenticate);

const HR  = requireRole('admin', 'hr');
const ALL = requireRole('admin', 'hr', 'operations', 'finance', 'employee');

router.get('/search', HR, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = (req.query.skill as string) ?? '';
    res.json({ success: true, data: await svc.searchSkills(skill) });
  } catch (e) { next(e); }
});

router.get('/employee/:employeeId', ALL, async (req, res, next) => {
  try { res.json({ success: true, data: await svc.getEmployeeSkills(req.params.employeeId) }); } catch (e) { next(e); }
});

router.post('/employee/:employeeId', ALL, validateBody(createSkillSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.addSkill(req.params.employeeId, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.put('/:id', ALL, validateBody(updateSkillSchema), async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateSkill(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); }
});

router.delete('/:id', ALL, async (req, res, next) => {
  try { await svc.deleteSkill(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); }
});

export default router;
