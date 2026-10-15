import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createTemplateSchema, updateTemplateSchema, createTaskSchema, toggleTaskSchema } from '../schemas/offboarding.schema';
import * as svc from '../services/offboarding.service';

const router = Router();
router.use(authenticate);

// Templates
router.get('/templates',        requirePermission('offboarding.view', 'admin', 'hr'), async (_req, res, next) => { try { res.json({ success: true, data: await svc.listTemplates() }); } catch (e) { next(e); } });
router.post('/templates',       requirePermission('offboarding.manage', 'admin', 'hr'), validateBody(createTemplateSchema), async (req, res, next) => { try { res.json({ success: true, data: await svc.createTemplate(req.body, req.user!.id) }); } catch (e) { next(e); } });
router.put('/templates/:id',    requirePermission('offboarding.manage', 'admin', 'hr'), validateBody(updateTemplateSchema), async (req, res, next) => { try { res.json({ success: true, data: await svc.updateTemplate(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); } });
router.delete('/templates/:id', requirePermission('offboarding.manage', 'admin', 'hr'), async (req, res, next) => { try { await svc.deleteTemplate(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); } });

// Employee tasks
router.get('/tasks/:employeeId',         requirePermission('offboarding.view', 'admin', 'hr'), async (req, res, next) => { try { res.json({ success: true, data: await svc.getEmployeeTasks(req.params.employeeId) }); } catch (e) { next(e); } });
router.post('/tasks/:employeeId',        requirePermission('offboarding.manage', 'admin', 'hr'), validateBody(createTaskSchema), async (req, res, next) => { try { res.json({ success: true, data: await svc.addTask(req.params.employeeId, req.body, req.user!.id) }); } catch (e) { next(e); } });
router.post('/tasks/:employeeId/generate', requirePermission('offboarding.manage', 'admin', 'hr'), async (req, res, next) => { try { await svc.generateTasksForEmployee(req.params.employeeId, req.user!.id); res.json({ success: true }); } catch (e) { next(e); } });
router.patch('/tasks/:taskId/toggle',    requirePermission('offboarding.manage', 'admin', 'hr'), validateBody(toggleTaskSchema), async (req, res, next) => { try { res.json({ success: true, data: await svc.toggleTask(req.params.taskId, req.user!.id) }); } catch (e) { next(e); } });

export default router;
