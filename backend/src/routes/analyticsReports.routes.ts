import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as svc from '../services/analyticsReports.service';

const router = Router();
router.use(authenticate);

router.get('/headcount',            requirePermission('analyticsReports.view.headcount', 'admin', 'hr'),  async (_req, res, next) => { try { res.json({ success: true, data: await svc.getHeadcount() }); } catch(e) { next(e); } });
router.get('/milestones',           requirePermission('analyticsReports.view.milestones', 'admin', 'hr'),  async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getMilestones(m) }); } catch(e) { next(e); } });
router.get('/probation',            requirePermission('analyticsReports.view.probation', 'admin', 'hr'),  async (_req, res, next) => { try { res.json({ success: true, data: await svc.getProbationEmployees() }); } catch(e) { next(e); } });
router.get('/capacity',             requirePermission('analyticsReports.view', 'admin', 'hr', 'operations'), async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getCapacityUtilization(m) }); } catch(e) { next(e); } });
router.get('/workforce-availability', requirePermission('analyticsReports.view', 'admin', 'hr', 'operations'), async (req, res, next) => { try { const { startDate = new Date().toISOString().slice(0,10), endDate } = req.query as any; res.json({ success: true, data: await svc.getWorkforceAvailability(startDate, endDate ?? startDate) }); } catch(e) { next(e); } });
router.get('/contractor-compliance', requirePermission('analyticsReports.view', 'admin', 'hr', 'operations'), async (_req, res, next) => { try { res.json({ success: true, data: await svc.getContractorCompliance() }); } catch(e) { next(e); } });
router.get('/client-sla',           requirePermission('analyticsReports.view', 'admin', 'hr', 'operations'), async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getClientSLA(m) }); } catch(e) { next(e); } });
router.get('/cash-flow-forecast',   requirePermission('analyticsReports.view.cash-flow-forecast', 'admin', 'finance'), async (req, res, next) => { try { const months = Number(req.query.months ?? 3); res.json({ success: true, data: await svc.getCashFlowForecast(months) }); } catch(e) { next(e); } });
router.get('/invoice-analytics',    requirePermission('analyticsReports.view.invoice-analytics', 'admin', 'finance'), async (_req, res, next) => { try { res.json({ success: true, data: await svc.getInvoiceAnalytics() }); } catch(e) { next(e); } });
router.get('/expense-analytics',    requirePermission('analyticsReports.view.expense-analytics', 'admin', 'finance'), async (_req, res, next) => { try { res.json({ success: true, data: await svc.getExpenseAnalytics() }); } catch(e) { next(e); } });

export default router;
