import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import * as svc from '../services/analyticsReports.service';

const router = Router();
router.use(authenticate);

const ADMIN_HR  = requireRole('admin', 'hr');
const ADMIN_FIN = requireRole('admin', 'finance');
const ADMIN_OPS = requireRole('admin', 'hr', 'operations');
const ALL_MGMT  = requireRole('admin', 'hr', 'operations', 'finance');

router.get('/headcount',            ADMIN_HR,  async (_req, res, next) => { try { res.json({ success: true, data: await svc.getHeadcount() }); } catch(e) { next(e); } });
router.get('/milestones',           ADMIN_HR,  async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getMilestones(m) }); } catch(e) { next(e); } });
router.get('/probation',            ADMIN_HR,  async (_req, res, next) => { try { res.json({ success: true, data: await svc.getProbationEmployees() }); } catch(e) { next(e); } });
router.get('/capacity',             ADMIN_OPS, async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getCapacityUtilization(m) }); } catch(e) { next(e); } });
router.get('/workforce-availability', ADMIN_OPS, async (req, res, next) => { try { const { startDate = new Date().toISOString().slice(0,10), endDate } = req.query as any; res.json({ success: true, data: await svc.getWorkforceAvailability(startDate, endDate ?? startDate) }); } catch(e) { next(e); } });
router.get('/contractor-compliance', ADMIN_OPS, async (_req, res, next) => { try { res.json({ success: true, data: await svc.getContractorCompliance() }); } catch(e) { next(e); } });
router.get('/client-sla',           ADMIN_OPS, async (req, res, next) => { try { const m = (req.query.month as string) ?? new Date().toISOString().slice(0,7); res.json({ success: true, data: await svc.getClientSLA(m) }); } catch(e) { next(e); } });
router.get('/cash-flow-forecast',   ADMIN_FIN, async (req, res, next) => { try { const months = Number(req.query.months ?? 3); res.json({ success: true, data: await svc.getCashFlowForecast(months) }); } catch(e) { next(e); } });
router.get('/invoice-analytics',    ADMIN_FIN, async (_req, res, next) => { try { res.json({ success: true, data: await svc.getInvoiceAnalytics() }); } catch(e) { next(e); } });
router.get('/expense-analytics',    ADMIN_FIN, async (_req, res, next) => { try { res.json({ success: true, data: await svc.getExpenseAnalytics() }); } catch(e) { next(e); } });

export default router;
