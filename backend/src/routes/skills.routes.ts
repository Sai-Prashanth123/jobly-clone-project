import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createSkillSchema, updateSkillSchema } from '../schemas/skills.schema';
import { ForbiddenError } from '../lib/errors';
import * as svc from '../services/skills.service';

const router = Router();
router.use(authenticate);

const HR = requireRole('admin', 'hr');
// Staff who may look at anyone's skills, plus the employee themselves — the
// per-record scoping below is what keeps "employee" honest.
const READ = requireRole('admin', 'hr', 'operations', 'finance', 'employee');

/**
 * An employee may only touch their OWN skills.
 *
 * These routes previously admitted five roles and then passed
 * `req.params.employeeId` straight to the service with no reference to
 * `req.user` at all — so any employee could read, add, rewrite or delete any
 * other employee's skill records simply by changing the id in the URL. Mirrors
 * the check already used for the identical URL shape in assets.controller.ts.
 */
function assertOwnSkillsOrStaff(req: Request, employeeId: string | null | undefined): void {
  if (req.user!.role !== 'employee') return;
  if (!employeeId || employeeId !== req.user!.employeeId) {
    throw new ForbiddenError('You may only manage your own skills');
  }
}

router.get('/search', HR, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = (req.query.skill as string) ?? '';
    res.json({ success: true, data: await svc.searchSkills(skill) });
  } catch (e) { next(e); }
});

router.get('/employee/:employeeId', READ, async (req, res, next) => {
  try {
    assertOwnSkillsOrStaff(req, req.params.employeeId);
    res.json({ success: true, data: await svc.getEmployeeSkills(req.params.employeeId) });
  } catch (e) { next(e); }
});

router.post('/employee/:employeeId', READ, validateBody(createSkillSchema), async (req, res, next) => {
  try {
    assertOwnSkillsOrStaff(req, req.params.employeeId);
    res.json({ success: true, data: await svc.addSkill(req.params.employeeId, req.body, req.user!.id) });
  } catch (e) { next(e); }
});

// PUT/DELETE address a skill by its own id, so the owning employee has to be
// looked up before the caller can be judged.
router.put('/:id', READ, validateBody(updateSkillSchema), async (req, res, next) => {
  try {
    assertOwnSkillsOrStaff(req, await svc.getSkillOwner(req.params.id));
    res.json({ success: true, data: await svc.updateSkill(req.params.id, req.body, req.user!.id) });
  } catch (e) { next(e); }
});

router.delete('/:id', READ, async (req, res, next) => {
  try {
    assertOwnSkillsOrStaff(req, await svc.getSkillOwner(req.params.id));
    await svc.deleteSkill(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
