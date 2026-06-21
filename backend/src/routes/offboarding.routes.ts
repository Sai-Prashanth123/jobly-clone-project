import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/offboarding.service';

const router = Router();
router.use(authenticate);

const HR = requireRole('admin', 'hr');

// Templates
router.get('/templates',        HR, async (_req, res, next) => { try { res.json({ success: true, data: await svc.listTemplates() }); } catch (e) { next(e); } });
router.post('/templates',       HR, async (req, res, next) => { try { res.json({ success: true, data: await svc.createTemplate(req.body, req.user!.id) }); } catch (e) { next(e); } });
router.put('/templates/:id',    HR, async (req, res, next) => { try { res.json({ success: true, data: await svc.updateTemplate(req.params.id, req.body, req.user!.id) }); } catch (e) { next(e); } });
router.delete('/templates/:id', HR, async (req, res, next) => { try { await svc.deleteTemplate(req.params.id, req.user!.id); res.json({ success: true }); } catch (e) { next(e); } });

// Employee tasks
router.get('/tasks/:employeeId',         HR, async (req, res, next) => { try { res.json({ success: true, data: await svc.getEmployeeTasks(req.params.employeeId) }); } catch (e) { next(e); } });
router.post('/tasks/:employeeId',        HR, async (req, res, next) => { try { res.json({ success: true, data: await svc.addTask(req.params.employeeId, req.body, req.user!.id) }); } catch (e) { next(e); } });
router.post('/tasks/:employeeId/generate', HR, async (req, res, next) => { try { await svc.generateTasksForEmployee(req.params.employeeId, req.user!.id); res.json({ success: true }); } catch (e) { next(e); } });
router.patch('/tasks/:taskId/toggle',    HR, async (req, res, next) => { try { res.json({ success: true, data: await svc.toggleTask(req.params.taskId, req.user!.id) }); } catch (e) { next(e); } });

export default router;
